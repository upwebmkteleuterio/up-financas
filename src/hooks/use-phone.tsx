import * as React from "react";

const PHONE_BREAKPOINT = 768;

export function useIsPhone() {
  const [isPhone, setIsPhone] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${PHONE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsPhone(window.innerWidth < PHONE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsPhone(window.innerWidth < PHONE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isPhone;
}