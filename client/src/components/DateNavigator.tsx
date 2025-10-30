import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface DateNavigatorProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onOpenCalendar?: () => void;
}

export default function DateNavigator({ selectedDate, onDateChange, onOpenCalendar }: DateNavigatorProps) {
  const handlePrevDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    onDateChange(newDate);
  };

  return (
    <div className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevDay}
          data-testid="button-prev-date"
          className="h-10 w-10"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <button
          onClick={onOpenCalendar}
          className="flex items-center gap-2 hover-elevate active-elevate-2 px-4 py-2 rounded-md"
          data-testid="button-open-calendar"
        >
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div className="text-center">
            <div className="text-2xl font-bold tabular-nums">
              {format(selectedDate, "EEE, MM/dd")}
            </div>
          </div>
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextDay}
          data-testid="button-next-date"
          className="h-10 w-10"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
