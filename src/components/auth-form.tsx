"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  loginAction,
  signupAction,
  type AuthActionState,
} from "@/app/auth/actions";

const initialAuthState: AuthActionState = { status: "idle" };

type AuthFormProps = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const action = mode === "login" ? loginAction : signupAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialAuthState,
  );
  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="stack">
      <div className="field">
        <label htmlFor={`${mode}-email`}>Email</label>
        <input
          id={`${mode}-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        {state.fieldErrors?.email && (
          <p className="field-error">{state.fieldErrors.email}</p>
        )}
      </div>

      <div className="field">
        <label htmlFor={`${mode}-password`}>Пароль</label>
        <input
          id={`${mode}-password`}
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={8}
          required
        />
        {state.fieldErrors?.password && (
          <p className="field-error">{state.fieldErrors.password}</p>
        )}
      </div>

      {isSignup && (
        <div className="field">
          <label htmlFor="signup-confirm-password">Повторите пароль</label>
          <input
            id="signup-confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          {state.fieldErrors?.confirmPassword && (
            <p className="field-error">{state.fieldErrors.confirmPassword}</p>
          )}
        </div>
      )}

      {state.message && (
        <p
          className={state.status === "success" ? "notice success" : "notice"}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}

      <button className="button" type="submit" disabled={pending}>
        {pending
          ? "Подождите…"
          : isSignup
            ? "Создать аккаунт"
            : "Войти"}
      </button>

      <p className="muted center">
        {isSignup ? "Уже есть аккаунт?" : "Нет аккаунта?"} {" "}
        <Link href={isSignup ? "/login" : "/signup"}>
          {isSignup ? "Войти" : "Зарегистрироваться"}
        </Link>
      </p>
    </form>
  );
}
