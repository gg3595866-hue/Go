import { useState } from "react";
import DateNavigator from "../DateNavigator";

export default function DateNavigatorExample() {
  const [date, setDate] = useState(new Date());

  return (
    <DateNavigator
      selectedDate={date}
      onDateChange={(newDate) => {
        setDate(newDate);
        console.log('Date changed to:', newDate);
      }}
      onOpenCalendar={() => console.log('Open calendar clicked')}
    />
  );
}
