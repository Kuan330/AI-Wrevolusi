# Current data dictionary

Source snapshot: aa4f8fb. This describes source definitions, not an inspected live database.

PK means primary key. FK means declared foreign key. Nullable means the value can be absent. Legacy tables are listed separately and are not assumed to be in use.

## app_accounts

Group: identity. Source: `backend/app/models/account.py:8`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| user_id | UUID | Yes | No | app_users.id |
| username | VARCHAR(32) |  | No |  |
| workspace | JSON |  | No |  |
| revision | INTEGER |  | No |  |
| created_at | TIMESTAMP WITH TIME ZONE |  | No |  |
| updated_at | TIMESTAMP WITH TIME ZONE |  | No |  |

Unique: username.

## catalogue_courses

Group: catalogue. Source: `backend/app/models/catalogue.py:16`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | UUID | Yes | No |  |
| course_code | VARCHAR(32) |  | No |  |
| skill_id | INTEGER |  | No | ref_wef_skills.wef_skill_id |
| level | VARCHAR(16) |  | No |  |
| course_no | INTEGER |  | No |  |
| collection_status | VARCHAR(24) |  | No |  |
| title | TEXT |  | No |  |
| provider | TEXT |  | No |  |
| url | TEXT |  | No |  |
| course_description | TEXT |  | No |  |
| outcomes | TEXT |  | No |  |
| language | VARCHAR(120) |  | No |  |
| format | TEXT |  | No |  |
| self_paced | BOOLEAN |  | No |  |
| duration_min | INTEGER |  | Yes |  |
| register | VARCHAR(24) |  | No |  |
| prereq | TEXT |  | No |  |
| match | TEXT |  | No |  |
| advice | TEXT |  | No |  |
| official_level | VARCHAR(80) |  | No |  |
| level_source | VARCHAR(32) |  | No |  |
| difficulty_note | TEXT |  | No |  |
| chapter_status | VARCHAR(80) |  | No |  |
| chapter_note | TEXT |  | No |  |
| chapter_source_url | TEXT |  | No |  |
| created_at | TIMESTAMP WITH TIME ZONE |  | No |  |
| updated_at | TIMESTAMP WITH TIME ZONE |  | No |  |

Unique: skill_id, level, course_no.
Unique: course_code.

## catalogue_chapters

Group: catalogue. Source: `backend/app/models/catalogue.py:59`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | UUID | Yes | No |  |
| course_id | UUID |  | No | catalogue_courses.id |
| chapter_order | INTEGER |  | No |  |
| parent_order | INTEGER |  | Yes |  |
| level | VARCHAR(24) |  | No |  |
| title | TEXT |  | No |  |
| duration_min | INTEGER |  | Yes |  |
| created_at | TIMESTAMP WITH TIME ZONE |  | No |  |
| updated_at | TIMESTAMP WITH TIME ZONE |  | No |  |

Unique: course_id, chapter_order.

## task_capability_link

Group: task. Source: `backend/app/models/task.py:18`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| task_id | UUID | Yes | No | tasks.id |
| capability_id | UUID | Yes | No | capabilities.id |


## tasks

Group: task. Source: `backend/app/models/task.py:26`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | UUID | Yes | No |  |
| user_id | UUID |  | No | app_users.id |
| occupation_id | UUID |  | Yes | occupations.id |
| title | VARCHAR(200) |  | No |  |
| description | TEXT |  | Yes |  |
| status | taskstatus |  | No |  |
| exposure_type | exposuretype |  | No |  |
| context | JSON |  | Yes |  |
| created_at | TIMESTAMP WITH TIME ZONE |  | No |  |
| updated_at | TIMESTAMP WITH TIME ZONE |  | No |  |


## capabilities

Group: task. Source: `backend/app/models/capability.py:23`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | UUID | Yes | No |  |
| user_id | UUID |  | No | app_users.id |
| name | VARCHAR(120) |  | No |  |
| description | TEXT |  | Yes |  |
| evolution | capabilityevolution |  | No |  |
| evidence | JSON |  | Yes |  |
| created_at | TIMESTAMP WITH TIME ZONE |  | No |  |
| updated_at | TIMESTAMP WITH TIME ZONE |  | No |  |


## learning_progress

Group: learning. Source: `backend/app/models/learning.py:36`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | UUID | Yes | No |  |
| user_id | UUID |  | No | app_users.id |
| skill_id | VARCHAR(120) |  | No |  |
| course_id | VARCHAR(32) |  | No |  |
| chapter_index | INTEGER |  | No |  |
| value | INTEGER |  | No |  |
| last_studied_on | DATE |  | No |  |
| created_at | TIMESTAMP WITH TIME ZONE |  | No |  |
| updated_at | TIMESTAMP WITH TIME ZONE |  | No |  |

Unique: user_id, skill_id, course_id, chapter_index.

## learning_checkins

Group: learning. Source: `backend/app/models/learning.py:67`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | UUID | Yes | No |  |
| user_id | UUID |  | No | app_users.id |
| checked_on | DATE |  | No |  |
| created_at | TIMESTAMP WITH TIME ZONE |  | No |  |
| updated_at | TIMESTAMP WITH TIME ZONE |  | No |  |

Unique: user_id, checked_on.

## daily_briefs

Group: learning. Source: `backend/app/models/learning.py:86`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | UUID | Yes | No |  |
| user_id | UUID |  | No | app_users.id |
| brief_date | DATE |  | No |  |
| variant | VARCHAR(24) |  | No |  |
| generated_by_model | BOOLEAN |  | No |  |
| content | JSON |  | No |  |
| created_at | TIMESTAMP WITH TIME ZONE |  | No |  |
| updated_at | TIMESTAMP WITH TIME ZONE |  | No |  |

Unique: user_id, brief_date, variant.

## occupations

Group: work. Source: `backend/app/models/occupation.py:15`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | UUID | Yes | No |  |
| masco_code | VARCHAR(20) |  | No |  |
| title | VARCHAR(120) |  | No |  |
| industry | VARCHAR(120) |  | No |  |
| description | TEXT |  | Yes |  |
| created_at | TIMESTAMP WITH TIME ZONE |  | No |  |
| updated_at | TIMESTAMP WITH TIME ZONE |  | No |  |

Unique: masco_code.

## preparations

Group: work. Source: `backend/app/models/preparation.py:22`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | UUID | Yes | No |  |
| user_id | UUID |  | No | app_users.id |
| title | VARCHAR(150) |  | No |  |
| rationale | TEXT |  | No |  |
| effort_level | INTEGER |  | No |  |
| priority | prioritylevel |  | No |  |
| created_at | TIMESTAMP WITH TIME ZONE |  | No |  |
| updated_at | TIMESTAMP WITH TIME ZONE |  | No |  |


## refresh_tokens

Group: identity. Source: `backend/app/models/refresh_token.py:15`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | UUID | Yes | No |  |
| user_id | UUID |  | No | app_users.id |
| token_jti | VARCHAR(64) |  | No |  |
| expires_at | TIMESTAMP WITH TIME ZONE |  | No |  |
| revoked_at | TIMESTAMP WITH TIME ZONE |  | Yes |  |
| created_at | TIMESTAMP WITH TIME ZONE |  | No |  |
| updated_at | TIMESTAMP WITH TIME ZONE |  | No |  |

Unique: token_jti.

## schedules

Group: work. Source: `backend/app/models/schedule.py:16`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | UUID | Yes | No |  |
| user_id | UUID |  | No | app_users.id |
| preparation_id | UUID |  | No | preparations.id |
| planned_for | DATE |  | No |  |
| is_done | BOOLEAN |  | No |  |
| note | TEXT |  | Yes |  |
| created_at | TIMESTAMP WITH TIME ZONE |  | No |  |
| updated_at | TIMESTAMP WITH TIME ZONE |  | No |  |


## task_assist_interactions

Group: task. Source: `backend/app/models/task_assist.py:17`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | UUID | Yes | No |  |
| user_id | UUID |  | No | app_users.id |
| task_key | VARCHAR(128) |  | No |  |
| task_text | TEXT |  | No |  |
| notes | TEXT |  | No |  |
| status | VARCHAR(16) |  | No |  |
| claim_token | UUID |  | Yes |  |
| claimed_at | TIMESTAMP WITH TIME ZONE |  | Yes |  |
| question | TEXT |  | Yes |  |
| reply | TEXT |  | Yes |  |
| generated_by_model | BOOLEAN |  | Yes |  |
| needs_user_confirmation | BOOLEAN |  | No |  |
| completed_at | TIMESTAMP WITH TIME ZONE |  | Yes |  |
| created_at | TIMESTAMP WITH TIME ZONE |  | No |  |
| updated_at | TIMESTAMP WITH TIME ZONE |  | No |  |

Unique: user_id, task_key.

## app_users

Group: identity. Source: `backend/app/models/user.py:21`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | UUID | Yes | No |  |
| email | VARCHAR(255) |  | No |  |
| full_name | VARCHAR(120) |  | No |  |
| hashed_password | VARCHAR(255) |  | No |  |
| is_active | BOOLEAN |  | No |  |
| occupation_id | UUID |  | Yes | occupations.id |
| created_at | TIMESTAMP WITH TIME ZONE |  | No |  |
| updated_at | TIMESTAMP WITH TIME ZONE |  | No |  |

Unique: email.

## ref_occupations

Group: reference. Source: `db/schema.sql:10`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| occupation_code | TEXT | Yes | No |  |
| level | TEXT |  | No |  |
| parent_code | TEXT |  | Yes |  |
| title | TEXT |  | No |  |
| description | TEXT |  | Yes |  |
| skill_level | TEXT |  | Yes |  |
| source | TEXT |  | Yes |  |
| source_year | TEXT |  | Yes |  |


## ref_ilo_tasks

Group: reference. Source: `db/schema.sql:27`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| isco_08 | TEXT | Yes | No |  |
| task_id | TEXT | Yes | No |  |
| title | TEXT |  | Yes |  |
| task_text | TEXT |  | Yes |  |
| score_2025 | DOUBLE PRECISION |  | Yes |  |
| potential25 | TEXT |  | Yes |  |
| potential23 | TEXT |  | Yes |  |
| mean_score_2025 | DOUBLE PRECISION |  | Yes |  |
| source | TEXT |  | Yes |  |
| source_year | TEXT |  | Yes |  |


## ref_wef_skills

Group: reference. Source: `db/schema.sql:44`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| wef_skill_id | INTEGER | Yes | No |  |
| core_skill | TEXT |  | No |  |
| wef_skill_group | TEXT |  | Yes |  |
| core_skill_importance_2025_pct | INTEGER |  | Yes |  |
| future_net_increase_2025_2030 | INTEGER |  | Yes |  |
| future_trend_category | TEXT |  | Yes |  |
| genai_substitution_capacity_category | TEXT |  | Yes |  |
| genai_chart_label | TEXT |  | Yes |  |
| source | TEXT |  | Yes |  |
| source_year | TEXT |  | Yes |  |
| source_figures | TEXT |  | Yes |  |

Unique: core_skill.

## users

Group: legacy. Source: `db/schema.sql:62`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | TEXT | Yes | No |  |
| display_name | TEXT |  | Yes |  |
| created_at | TIMESTAMPTZ |  | Yes |  |


## work_profiles

Group: legacy. Source: `db/schema.sql:68`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | TEXT | Yes | No |  |
| user_id | TEXT |  | No | users.id |
| occupation_code | TEXT |  | Yes |  |
| confirmation_status | TEXT |  | Yes |  |
| confirmed_at | TIMESTAMPTZ |  | Yes |  |


## profile_tasks

Group: legacy. Source: `db/schema.sql:76`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | TEXT | Yes | No |  |
| work_profile_id | TEXT |  | No | work_profiles.id |
| ilo_isco_08 | TEXT |  | Yes |  |
| ilo_task_id | TEXT |  | Yes |  |
| task_text | TEXT |  | Yes |  |
| status | TEXT |  | Yes |  |
| input_method | TEXT |  | Yes |  |
| time_spent | TEXT |  | Yes |  |
| responsibility_level | TEXT |  | Yes |  |
| is_user_added | BOOLEAN |  | Yes |  |


## task_assessments

Group: legacy. Source: `db/schema.sql:89`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | TEXT | Yes | No |  |
| profile_task_id | TEXT |  | No | profile_tasks.id |
| suggested_state | TEXT |  | Yes |  |
| match_layer | TEXT |  | Yes |  |
| source | TEXT |  | Yes |  |
| reasoning | TEXT |  | Yes |  |
| uncertainty | TEXT |  | Yes |  |
| limitations | TEXT |  | Yes |  |
| missing_data_status | TEXT |  | Yes |  |
| confirmation_status | TEXT |  | Yes |  |


## profile_wef_skills

Group: legacy. Source: `db/schema.sql:102`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | TEXT | Yes | No |  |
| work_profile_id | TEXT |  | No | work_profiles.id |
| wef_skill_id | INTEGER |  | Yes |  |
| wef_core_skill | TEXT |  | Yes |  |
| interpretation | TEXT |  | Yes |  |
| match_layer | TEXT |  | Yes |  |
| source | TEXT |  | Yes |  |
| reasoning | TEXT |  | Yes |  |
| uncertainty | TEXT |  | Yes |  |
| limitations | TEXT |  | Yes |  |
| missing_data_status | TEXT |  | Yes |  |
| confirmation_status | TEXT |  | Yes |  |
| is_user_added | BOOLEAN |  | Yes |  |


## wef_skill_task_links

Group: legacy. Source: `db/schema.sql:118`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| profile_wef_skill_id | TEXT | Yes | No | profile_wef_skills.id |
| profile_task_id | TEXT | Yes | No | profile_tasks.id |


## skill_examples

Group: legacy. Source: `db/schema.sql:124`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | TEXT | Yes | No |  |
| profile_wef_skill_id | TEXT |  | No | profile_wef_skills.id |
| example_text | TEXT |  | Yes |  |


## review_events

Group: legacy. Source: `db/schema.sql:130`.

| Column | Type | PK | Nullable | Declared FK |
|---|---|---|---|---|
| id | TEXT | Yes | No |  |
| work_profile_id | TEXT |  | No | work_profiles.id |
| entity_type | TEXT |  | Yes |  |
| entity_id | TEXT |  | Yes |  |
| action | TEXT |  | Yes |  |
| previous_value | TEXT |  | Yes |  |
| new_value | TEXT |  | Yes |  |
| created_at | TIMESTAMPTZ |  | Yes |  |
