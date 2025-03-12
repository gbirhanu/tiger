import { useState } from 'react';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Flame } from 'lucide-react';
import { cn } from '../lib/utils';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-secondary/20">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Flame className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight">Tiger</h1>
          </div>
          <p className="text-muted-foreground">
            Your all-in-one productivity and task management solution
          </p>
        </div>

        <Card className="p-6">
          <div className="flex space-x-4 mb-6">
            <Button
              variant={isLogin ? "default" : "outline"}
              className={cn("flex-1 font-medium", {
                "bg-primary text-primary-foreground": isLogin,
              })}
              onClick={() => setIsLogin(true)}
            >
              Login
            </Button>
            <Button
              variant={!isLogin ? "default" : "outline"}
              className={cn("flex-1 font-medium", {
                "bg-primary text-primary-foreground": !isLogin,
              })}
              onClick={() => setIsLogin(false)}
            >
              Register
            </Button>
          </div>

          {isLogin ? <LoginForm /> : <RegisterForm />}
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          By continuing, you agree to our{" "}
          <a href="#" className="underline underline-offset-4 hover:text-primary">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="underline underline-offset-4 hover:text-primary">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
} 