"use client";
import { useState, useEffect } from "react";

interface NotificationProps {
  message: string;
  type: "success" | "error" | "info";
  duration?: number;
  onClose?: () => void;
}

export default function Notification({ 
  message, 
  type = "success", 
  duration = 3000, 
  onClose 
}: NotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300); // Wait for animation to complete
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose?.(), 300);
  };

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return "bg-gradient-to-r from-emerald-500 to-green-600 border-emerald-400";
      case "error":
        return "bg-gradient-to-r from-red-500 to-rose-600 border-red-400";
      case "info":
        return "bg-gradient-to-r from-blue-500 to-cyan-600 border-blue-400";
      default:
        return "bg-gradient-to-r from-emerald-500 to-green-600 border-emerald-400";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return "✅";
      case "error":
        return "❌";
      case "info":
        return "ℹ️";
      default:
        return "✅";
    }
  };

  return (
    <div
      className={`fixed top-6 right-6 z-50 transform transition-all duration-300 ease-out ${
        isVisible 
          ? "translate-x-0 opacity-100 scale-100" 
          : "translate-x-full opacity-0 scale-95"
      }`}
    >
      <div
        className={`${getTypeStyles()} backdrop-blur-sm border-2 rounded-2xl shadow-2xl p-6 max-w-md min-w-80`}
      >
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
              {getIcon()}
            </div>
          </div>
          
          <div className="flex-1">
            <h3 className="text-white font-semibold text-lg mb-1">
              {type === "success" ? "Success!" : type === "error" ? "Error!" : "Info"}
            </h3>
            <p className="text-white/90 text-sm leading-relaxed">
              {message}
            </p>
          </div>
          
          <button
            onClick={handleClose}
            className="flex-shrink-0 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors duration-200"
          >
            <span className="text-white text-lg">×</span>
          </button>
        </div>
        
        {/* Progress bar */}
        {duration > 0 && (
          <div className="mt-4 w-full bg-white/20 rounded-full h-1 overflow-hidden">
            <div 
              className="bg-white h-full rounded-full transition-all duration-300 ease-linear"
              style={{
                width: isVisible ? "100%" : "0%",
                transition: `width ${duration}ms linear`
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
