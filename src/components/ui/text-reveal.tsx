import { motion, useReducedMotion } from "motion/react";
import type { HTMLAttributes } from "react";

interface TextRevealProps extends Omit<HTMLAttributes<HTMLParagraphElement>, "children"> {
  text: string;
}

export const TextReveal = ({ text, className, ...props }: TextRevealProps) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <p aria-live="polite" className={className} {...props}>
      <motion.span
        key={text}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 4, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {text}
      </motion.span>
    </p>
  );
};

export default TextReveal;
