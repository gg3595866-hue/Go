import { useState } from "react";
import ViewToggle from "../ViewToggle";

export default function ViewToggleExample() {
  const [view, setView] = useState<'competition' | 'time'>('competition');

  return (
    <ViewToggle
      view={view}
      onViewChange={(newView) => {
        setView(newView);
        console.log('View changed to:', newView);
      }}
    />
  );
}
