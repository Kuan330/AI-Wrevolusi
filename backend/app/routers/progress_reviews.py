"""Explicit review writes only. Read endpoints never create or rewrite evidence."""
import json
from datetime import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.account import Account
from app.models.progress_review import ProgressReview
from app.routers.accounts import current_account
from app.schemas.progress_reviews import CreateProgressReview
from app.services import progress_reviews as service

router = APIRouter(prefix='/progress-reviews', tags=['Progress reviews'])


async def progress_db(db: AsyncSession=Depends(get_db)):
    try:
        yield db
    except ProgrammingError as error:
        if getattr(error.orig,'sqlstate',None)=='42P01' and any(name in (error.statement or '') for name in ('progress_reviews','ref_specialist_concepts','ref_wef_skills')):
            raise HTTPException(503,'Progress review storage is temporarily unavailable. Your saved learning records are kept. Please try again later.') from error
        raise


async def records_for(db, account):
    records=service.read_records(account.workspace)
    checks=await service.catalogue_checks(db,records['goals'])
    return records,checks


async def latest(db, user_id):
    return await db.scalar(select(ProgressReview).where(ProgressReview.user_id==user_id).order_by(ProgressReview.created_at.desc(),ProgressReview.id.desc()).limit(1))


@router.get('/preview')
async def preview(account: Account=Depends(current_account),db: AsyncSession=Depends(progress_db)):
    records,checks=await records_for(db,account)
    return service.build_preview(records,checks,account.revision,await latest(db,account.user_id))


@router.get('')
async def history(limit: int=Query(20,ge=1,le=50),offset: int=Query(0,ge=0,le=10000),account: Account=Depends(current_account),db: AsyncSession=Depends(progress_db)):
    records,checks=await records_for(db,account)
    evidence=service.current_evidence(records,checks,service.stamp())
    total=(await db.execute(select(func.count()).select_from(ProgressReview).where(ProgressReview.user_id==account.user_id))).scalar_one()
    rows=(await db.scalars(select(ProgressReview).where(ProgressReview.user_id==account.user_id).order_by(ProgressReview.created_at.desc(),ProgressReview.id.desc()).limit(limit).offset(offset))).all()
    return {'items':[service.present_review(row,evidence) for row in rows],'total':total,'limit':limit,'offset':offset}


@router.get('/{review_id}')
async def detail(review_id: uuid.UUID,account: Account=Depends(current_account),db: AsyncSession=Depends(progress_db)):
    row=await db.scalar(select(ProgressReview).where(ProgressReview.id==review_id,ProgressReview.user_id==account.user_id))
    if row is None:raise HTTPException(404,'This progress review was not found in your account.')
    records,checks=await records_for(db,account)
    return service.present_review(row,service.current_evidence(records,checks,service.stamp()),True)


@router.post('',status_code=201)
async def create(payload: CreateProgressReview,account: Account=Depends(current_account),db: AsyncSession=Depends(progress_db)):
    # Account saves use this same lock. The review and its expected workspace
    # version are checked together, including another tab's simultaneous review.
    account=await db.scalar(select(Account).where(Account.user_id==account.user_id).with_for_update().execution_options(populate_existing=True))
    request_hash=service.fingerprint(payload.model_dump(mode='json'))
    existing=await db.scalar(select(ProgressReview).where(ProgressReview.user_id==account.user_id,ProgressReview.request_id==payload.request_id))
    records,checks=await records_for(db,account)
    current=service.current_evidence(records,checks,service.stamp())
    if existing:
        if existing.request_hash!=request_hash:raise HTTPException(409,'This review request ID was already used for a different review. Reload the preview.')
        return service.present_review(existing,current,True)
    previous=await latest(db,account.user_id)
    if account.revision!=payload.expected_workspace_revision or (previous.id if previous else None)!=payload.expected_previous_review_id:
        raise HTTPException(409,'Your records or latest review changed. Refresh the preview before saving a new review.')
    preview=service.build_preview(records,checks,account.revision,previous)
    if not preview['can_save']:
        raise HTTPException(409,'Review the flagged skill connections or choose a learning goal before saving a progress review. Work-based goals need confirmed work context.')
    required=set(preview['required_reset_goal_ids'])
    if set(payload.reset_goal_ids)!=required:
        raise HTTPException(409,'Confirm exactly the goals marked as needing a new starting point. Earlier reviews will be kept.')
    for goal in preview['goals']:
        if goal['goal_id'] in required:
            goal['status']='starting_point'
            goal['earlier']=None
            goal['reason']='You chose a new starting point because this goal changed. Its earlier comparison remains in review history.'
    snapshot={'version':1,**preview}
    if len(json.dumps(snapshot,ensure_ascii=False).encode())>4_000_000:
        raise HTTPException(413,'This review contains too much supporting text to save together. Your existing reviews and learning records are unchanged.')
    review=ProgressReview(user_id=account.user_id,request_id=payload.request_id,request_hash=request_hash,
        previous_review_id=previous.id if previous else None,workspace_revision=account.revision,
        created_at=datetime.fromisoformat(preview['reviewed_at']),snapshot=snapshot)
    db.add(review)
    await db.flush()
    await db.refresh(review)
    await db.commit()
    return service.present_review(review,current,True)
