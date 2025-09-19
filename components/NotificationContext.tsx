import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { Snackbar } from "react-native-paper";

type Variant = "success" | "error" | "info";
type Options = { duration?: number; actionLabel?: string; onAction?: () => void; variant?: Variant };

type NotificationContextType = {
  showMessage: (message: string, options?: Options) => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [options, setOptions] = useState<Options>({});

  const showMessage = useCallback((msg: string, opts?: Options) => {
    setMessage(msg);
    setOptions(opts || {});
    setVisible(true);
  }, []);

  // Colores por variante (puedes alinear con tu tema)
  const bgByVariant =
    options.variant === "success" ? "#2e7d32" :
    options.variant === "error"   ? "#c62828" :
    "#1565c0"; // info

  return (
    <NotificationContext.Provider value={{ showMessage }}>
      {children}
      <Snackbar
        visible={visible}
        onDismiss={() => setVisible(false)}
        duration={options.duration ?? 3000}
        style={{ backgroundColor: bgByVariant }}
        action={
          options.actionLabel
            ? { label: options.actionLabel, onPress: options.onAction ?? (() => setVisible(false)) }
            : undefined
        }
      >
        {message}
      </Snackbar>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification debe usarse dentro de NotificationProvider");
  return ctx;
};
