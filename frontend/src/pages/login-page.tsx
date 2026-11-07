import { useMutation } from "@tanstack/react-query";
import { ArrowUpRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { GrowthRings } from "@/components/common/growth-rings";
import { Logo, SeedMark } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

interface LocationState {
  from?: {
    pathname?: string;
    search?: string;
  };
}

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: () => login(username.trim(), password),
    onSuccess: (session) => {
      toast.success(`Welcome back, ${session.user?.username ?? "station admin"}.`);
      const from = (location.state as LocationState | null)?.from;
      const destination =
        from?.pathname && from.pathname !== "/login"
          ? `${from.pathname}${from.search ?? ""}`
          : "/";
      navigate(destination, { replace: true });
    },
  });

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) return;
    mutation.mutate();
  };

  const error =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? "The station could not complete sign in. Try again."
        : null;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#080c07] text-[#edf0e2]">
      <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgb(185_205_150_/_0.12)_1px,transparent_1px),linear-gradient(90deg,rgb(185_205_150_/_0.12)_1px,transparent_1px)] [background-size:64px_64px]" />
      <div className="pointer-events-none absolute -left-[18%] bottom-[-13%] h-[72vw] max-h-[860px] w-[72vw] max-w-[860px] text-[#d7f26a] opacity-[0.17]">
        <GrowthRings className="size-full" />
      </div>

      <div className="relative mx-auto grid min-h-dvh max-w-[96rem] lg:grid-cols-[minmax(0,1.15fr)_minmax(28rem,0.85fr)]">
        <section className="flex min-h-[45dvh] flex-col px-5 pb-10 pt-6 sm:px-9 lg:min-h-dvh lg:px-14 lg:pb-12 lg:pt-9">
          <div className="flex items-center justify-between">
            <Logo className="min-h-11 text-[#edf0e2]" />
            <span className="hidden items-center gap-2 text-2xs text-[#96a18a] sm:flex">
              <ShieldCheck className="size-3.5 text-[#d7f26a]" />
              Local network only
            </span>
          </div>

          <div className="my-auto py-14 lg:max-w-2xl lg:py-20">
            <div className="mb-7 flex items-center gap-3 text-[#d7f26a]">
              <SeedMark className="size-7" />
              <span className="h-px w-12 bg-[#d7f26a]/40" aria-hidden="true" />
            </div>
            <h1 className="max-w-[12ch] font-display text-[clamp(3.4rem,8vw,7.8rem)] leading-[0.88] tracking-[-0.045em] text-[#f0f2e7]">
              A quiet place for loud downloads.
            </h1>
            <p className="mt-7 max-w-md text-[15px] leading-relaxed text-[#98a48d]">
              Your torrent engine, library, and files — tended on your own network.
              No accounts in the cloud. No middlemen in the path.
            </p>
          </div>

          <footer className="flex flex-wrap items-end justify-between gap-4 border-t border-[#2a3324] pt-5 text-[11px] text-[#85917c]">
            <p>SeedStation runs on your machine and stays there.</p>
            <span className="data">v1.0.0</span>
          </footer>
        </section>

        <section className="relative flex border-t border-[#2a3324] bg-[#0d120b] lg:border-l lg:border-t-0">
          <div className="m-auto w-full max-w-[27rem] px-5 py-12 sm:px-9 lg:px-8">
            <div className="mb-9">
              <p className="text-xs text-[#7f8b74]">Station access</p>
              <h2 className="mt-3 font-display text-[2.7rem] leading-none tracking-[-0.03em] text-[#edf0e2]">
                Welcome back.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#8f9b85]">
                Sign in with the administrator account created during setup.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-5" noValidate>
              <div>
                <Label htmlFor="username" className="text-[#c5ccba]">
                  Username
                </Label>
                <Input
                  id="username"
                  name="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  className="h-11 border-[#33402c] bg-[#080c07]/70 text-[#edf0e2] placeholder:text-[#7b8772] hover:border-[#4a5b40] focus:border-[#d7f26a]/55"
                  placeholder="admin"
                  disabled={mutation.isPending}
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-[#c5ccba]">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    className="h-11 border-[#33402c] bg-[#080c07]/70 pr-11 text-[#edf0e2] placeholder:text-[#7b8772] hover:border-[#4a5b40] focus:border-[#d7f26a]/55"
                    placeholder="Your passphrase"
                    disabled={mutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#85917c] transition-colors hover:text-[#edf0e2]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="rounded-md border border-[#ff9587]/25 bg-[#ff9587]/[0.07] px-3 py-2.5 text-xs leading-relaxed text-[#ffb5ab]"
                >
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="group h-11 w-full justify-between bg-[#d7f26a] text-[#111607] hover:bg-[#e1fa7b]"
                disabled={mutation.isPending || !username.trim() || !password}
              >
                {mutation.isPending ? "Opening the station…" : "Enter SeedStation"}
                <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Button>
            </form>

            <p className="mt-8 flex items-start gap-2 text-[11px] leading-relaxed text-[#85917c]">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              Sessions are protected by a CSRF token and rate-limited sign-in attempts.
              SeedStation does not accept traffic from outside your local network.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
