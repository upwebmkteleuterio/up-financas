import { motion, useReducedMotion } from "motion/react";
import { useMemo, type HTMLAttributes } from "react";

export type TextRevealMode = "word" | "character";

export interface UseTextRevealOptions {
  mode?: TextRevealMode;
  delay?: number;
  duration?: number;
  stagger?: number;
}

export interface TextRevealProps
  extends Omit<HTMLAttributes<HTMLParagraphElement>, "children">,
    UseTextRevealOptions {
  text: string;
}

export const useTextReveal = (text: string, options: UseTextRevealOptions = {}) => {
  const { mode = "word", delay = 0, duration = 0.2, stagger = 0.025 } = options;
  const prefersReducedMotion = useReducedMotion();
  const segments = useMemo(
    () => (mode === "character" ? Array.from(text) : text.split(/(\s+)/)),
    [mode, text],
  );

  return {
    segments,
    prefersReducedMotion,
    delay,
    duration,
    stagger,
  };
};

export const TextReveal = ({
  text,
  mode = "word",
  delay = 0,
  duration = 0.2,
  stagger = 0.025,
  className,
  ...props
}: TextRevealProps) => {
  const { segments, prefersReducedMotion } = useTextReveal(text, {
    mode,
    delay,
    duration,
    stagger,
  });

  return (
    <p className={className} {...props}>
      {segments.map((segment, index) => (
        <motion.span
          key={`${index}-${segment}`}
          aria-hidden="true"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 4, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            duration,
            delay: prefersReducedMotion ? 0 : delay + index * stagger,
            ease: "easeOut",
          }}
          style={{ display: "inline-block", overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}
        >
          {segment}
        </motion.span>
      ))}
    </p>
  );
};

export default TextReveal;
