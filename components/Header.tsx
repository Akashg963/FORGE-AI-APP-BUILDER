import Link from "next/link";
import { UserButton, SignInButton, Show } from "@clerk/nextjs";
import Image from "next/image";
import { Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkUser } from "@/lib/checkUser";
import { PricingModal } from "@/components/PricingModal";
import { PLANS } from "@/lib/constants";
import type { Plan } from "@/types/plans";

export default async function Header() {
  const user = await checkUser();

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-white/10 bg-[#09090b]/95 shadow-lg shadow-black/20 backdrop-blur-xl">
      <nav className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">

        {/* Forge Logo */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 select-none"
        >
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/5">
            <Image
              src="/logo-short.jpeg"
              alt="Forge"
              width={36}
              height={36}
              className="h-9 w-9 object-cover"
              priority
            />
          </div>

          <span className="text-lg font-semibold tracking-tight text-white transition-colors group-hover:text-white/90">
            Forge
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-5">

          <Show when="signed-in">
            <Link
              href="/projects"
              className="text-[13px] font-medium text-white/50 transition-colors hover:text-white"
            >
              Projects
            </Link>

            {user && (
              <PricingModal>
                <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-xs text-white/70 transition-colors hover:bg-white/10">
                  <Zap className="h-3 w-3 fill-white/70" />
                  {user.credits} credits
                </span>
              </PricingModal>
            )}

            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                },
              }}
            />
          </Show>

          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button
                variant="ghost"
                size="sm"
                className="text-[13px] font-medium text-white/50 hover:bg-transparent hover:text-white"
              >
                Sign in
              </Button>
            </SignInButton>

            <SignInButton mode="modal">
              <Button
                size="sm"
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold text-black hover:bg-white/90 active:scale-95"
              >
                Get Started
                <ArrowRight className="h-3 w-3 opacity-60" />
              </Button>
            </SignInButton>
          </Show>

        </div>
      </nav>
    </header>
  );
}