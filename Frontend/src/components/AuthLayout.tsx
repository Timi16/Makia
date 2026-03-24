import { ReactNode } from "react";

interface AuthLayoutProps {
  leftContent: ReactNode;
  rightContent: ReactNode;
}

const AuthLayout = ({ leftContent, rightContent }: AuthLayoutProps) => {
  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-[55%] folio-gradient relative overflow-hidden">
        <div className="relative z-10 flex flex-col justify-center px-16 py-12 w-full">
          {leftContent}
        </div>
        {/* Floating decorative elements */}
        <div className="absolute top-20 right-20 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-32 left-10 w-48 h-48 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute top-1/2 right-1/3 w-32 h-32 rounded-full bg-white/10 blur-xl" />
      </div>
      <div className="flex-1 flex flex-col bg-card">
        {rightContent}
      </div>
    </div>
  );
};

export default AuthLayout;
