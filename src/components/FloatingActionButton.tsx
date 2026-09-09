import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  colorClass: string; 
  className?: string;
  size?: "default" | "sm" | "lg" | "icon" | "fab-lg" | "fab-sm";
}

const FloatingActionButton = React.forwardRef<HTMLButtonElement, FloatingActionButtonProps>(({
  icon,
  onClick,
  colorClass,
  className,
  size = "fab-lg",
}, ref) => {
  const [isPressed, setIsPressed] = useState(false);
  const internalRef = useRef<HTMLButtonElement>(null);
  
  const buttonRef = (ref as React.RefObject<HTMLButtonElement>) || internalRef;
  
  let sizeClasses = "h-14 w-14"; 
  if (size === "fab-sm") {
      sizeClasses = "h-12 w-12"; 
  }

  const handleInteractionStart = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    setIsPressed(true);
    
    const button = buttonRef.current;
    if (!button) return;

    let clientX, clientY;
    if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const circle = document.createElement("span");
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    const rect = button.getBoundingClientRect();
    const x = clientX - rect.left - radius;
    const y = clientY - rect.top - radius;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;
    circle.classList.add("fab-ripple");

    button.appendChild(circle);
    
    const timeout = setTimeout(() => {
        circle.remove();
    }, 600);

    setTimeout(() => setIsPressed(false), 150);
    return () => clearTimeout(timeout);
  };

  return (
    <Button
      ref={ref}
      variant="default"
      size={undefined} 
      onClick={onClick}
      onMouseDown={handleInteractionStart}
      onTouchStart={handleInteractionStart}
      className={cn(
        "fixed z-40 rounded-full shadow-2xl transition-all duration-300 overflow-hidden",
        "text-white animate-in fade-in zoom-in duration-300",
        sizeClasses,
        colorClass,
        isPressed ? "scale-[0.98] shadow-md" : "scale-100 shadow-xl",
        className,
      )}
    >
      {icon}
    </Button>
  );
});

FloatingActionButton.displayName = "FloatingActionButton";

export default FloatingActionButton;