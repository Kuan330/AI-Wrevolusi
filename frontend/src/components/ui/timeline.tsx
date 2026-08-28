interface TimelineItem {
  id: string;
  title: string;
  detail?: string;
  time?: string;
}

interface TimelineProps {
  items: TimelineItem[];
}

const Timeline = ({ items }: TimelineProps) => {
  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="relative pl-6">
          <span className="absolute top-1 left-0 size-2 rounded-full bg-primary" />
          <span className="absolute top-3 left-[3px] h-full w-px bg-border" />
          <p className="text-sm font-medium">{item.title}</p>
          {item.detail ? <p className="text-xs text-muted-foreground">{item.detail}</p> : null}
          {item.time ? <p className="mt-1 text-xs text-muted-foreground">{item.time}</p> : null}
        </li>
      ))}
    </ol>
  );
};

export default Timeline;
