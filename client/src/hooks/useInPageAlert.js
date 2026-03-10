import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_DURATION = 3200;

export default function useInPageAlert() {
  const [alertState, setAlertState] = useState(null);
  const timerRef = useRef(null);

  const dismissAlert = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setAlertState(null);
  }, []);

  const showAlert = useCallback((message, type = "info", duration = DEFAULT_DURATION) => {
    if (!message) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setAlertState({
      id: Date.now(),
      message,
      type,
    });

    timerRef.current = setTimeout(() => {
      setAlertState(null);
      timerRef.current = null;
    }, duration);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  return {
    alertState,
    showAlert,
    dismissAlert,
  };
}
