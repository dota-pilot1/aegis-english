"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertCircle, LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { loginSchema, type LoginFormValues } from "@/shared/lib/validation/auth.schema";
import { authActions } from "@/entities/user/model/authStore";
import { getApiError } from "@/shared/api/errors";
import { FormField } from "@/shared/ui/FormField";
import { TextInput } from "@/shared/ui/TextInput";
import { PasswordInput } from "@/shared/ui/PasswordInput";

type LoginFormProps = {
  nextPath?: string;
};

const TEST_ACCOUNT = { email: "terecal@daum.net", password: "test1234" } as const;

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const { t } = useTranslation("auth");
  const [formError, setFormError] = useState<string | null>(null);

  const safePath =
    nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/dashboard";

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    defaultValues: {
      email: TEST_ACCOUNT.email,
      password: TEST_ACCOUNT.password,
    },
  });

  const fillTestAccount = () => {
    setFormError(null);
    setValue("email", TEST_ACCOUNT.email, { shouldValidate: true });
    setValue("password", TEST_ACCOUNT.password, { shouldValidate: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await authActions.login(values.email, values.password);
      toast.success(t("loginSuccess"));
      router.replace(safePath);
    } catch (e) {
      const apiError = getApiError(e);
      if (apiError?.code === "AUTH_003") {
        // 자격증명 오류: 상단 배너로 또렷하게 + 두 필드 모두 강조
        setFormError(apiError.message);
        setError("email", { type: "server" });
        setError("password", { type: "server" });
      } else if (apiError?.code === "AUTH_004") {
        setFormError(apiError.message);
        setError("email", { type: "server" });
      } else {
        setFormError(apiError?.message ?? t("loginFailed"));
      }
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={fillTestAccount}
          title="클릭하면 테스트 계정이 자동 입력됩니다"
          className="rounded-md border border-border bg-muted/40 px-2.5 py-1 text-right text-[11px] leading-tight text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <span className="font-semibold text-foreground">테스트 계정</span>
          <br />
          {TEST_ACCOUNT.email} / {TEST_ACCOUNT.password}
        </button>
      </div>

      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      <FormField label={t("email")} htmlFor="login-email" error={errors.email?.message}>
        <TextInput
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          invalid={!!errors.email}
          aria-invalid={!!errors.email}
          {...register("email")}
        />
      </FormField>

      <FormField label={t("password")} htmlFor="login-password" error={errors.password?.message}>
        <PasswordInput
          id="login-password"
          autoComplete="current-password"
          placeholder="••••••••"
          invalid={!!errors.password}
          aria-invalid={!!errors.password}
          {...register("password")}
        />
      </FormField>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium disabled:opacity-60 hover:opacity-90 transition-opacity"
      >
        <LogIn className="h-4 w-4" />
        {isSubmitting ? t("signingIn") : t("signInButton")}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href="/register" className="underline hover:text-foreground">
          {t("signUpLink")}
        </Link>
      </p>
    </form>
  );
}
