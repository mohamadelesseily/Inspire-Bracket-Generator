import React from 'react';

export const Button = ({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) => {
  const variants = {
    primary: 'bg-primary text-bg-black font-bold hover:bg-yellow-500 transition-colors shadow-[0_0_10px_rgba(250,204,21,0.2)]',
    secondary: 'bg-surface-dark text-accent-white border border-zinc-800 hover:bg-zinc-800 transition-colors',
    danger: 'bg-red-600 text-white hover:bg-red-700 transition-colors',
  };

  return (
    <button
      className={`px-4 py-2 rounded-md transition-all active:scale-95 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Card = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`bg-surface-dark border border-zinc-800 rounded-xl p-6 ${className}`} {...props}>
    {children}
  </div>
);

export const Input = ({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={`bg-zinc-950 border border-zinc-800 text-accent-white px-4 py-2 rounded-md focus:outline-none focus:border-primary transition-colors ${className}`}
    {...props}
  />
);
