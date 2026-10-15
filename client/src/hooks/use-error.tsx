import React, { createContext, useContext, useState, ReactNode } from 'react';

type ErrorDetails = {
    title: string;
    message: string;
    details?: string | unknown;
};

type ErrorContextType = {
    error: ErrorDetails | null;
    isOpen: boolean;
    showError: (error: ErrorDetails) => void;
    dismissError: () => void;
};

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
    const [error, setError] = useState<ErrorDetails | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    const showError = (newError: ErrorDetails) => {
        // Log for debugging/telemetry
        console.error("Global Error Caught:", newError);
        setError(newError);
        setIsOpen(true);
    };

    const dismissError = () => {
        setIsOpen(false);
        // Optional: clear error after animation, but keeping it ensures checks against null work until next error
        setTimeout(() => setError(null), 300);
    };

    return (
        <ErrorContext.Provider value={{ error, isOpen, showError, dismissError }}>
            {children}
        </ErrorContext.Provider>
    );
}

export function useError() {
    const context = useContext(ErrorContext);
    if (context === undefined) {
        throw new Error('useError must be used within an ErrorProvider');
    }
    return context;
}
