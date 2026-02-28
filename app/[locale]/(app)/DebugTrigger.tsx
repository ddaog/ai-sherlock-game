"use client";

import { useState } from 'react';
import { useTokenSystem } from '@/lib/hooks/useTokenSystem';

export default function DebugTrigger({ userId, children }: { userId: string; children: React.ReactNode }) {
    const { triggerDebugMode } = useTokenSystem(userId);
    const [clicks, setClicks] = useState(0);
    const [lastClickTime, setLastClickTime] = useState(0);

    const handleClick = () => {
        const now = Date.now();
        if (now - lastClickTime > 1000) {
            setClicks(1);
        } else {
            const newClicks = clicks + 1;
            setClicks(newClicks);
            if (newClicks >= 5) {
                const newState = triggerDebugMode();
                if (newState) {
                    alert("DEBUG MODE ACTIVATED: Tokens filled & All stories unlocked.");
                } else {
                    alert("DEBUG MODE DEACTIVATED: Play permissions returned to normal.");
                }
                setClicks(0);
            }
        }
        setLastClickTime(now);
    };

    return (
        <div onClick={handleClick} className="cursor-pointer select-none inline-flex items-center gap-2">
            {children}
        </div>
    );
}
