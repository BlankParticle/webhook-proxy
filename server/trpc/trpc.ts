import {
  TRPCError,
  initTRPC,
  experimental_standaloneMiddleware,
} from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./createContext";
import * as z from "zod";
import { OrgContext } from "../utils/orgSlug";

export const trpcContext = initTRPC
  .context<Context>()
  .create({ transformer: superjson });

const isUserAuthenticated = trpcContext.middleware(({ next, ctx }) => {
  if (!ctx.user || !ctx.user.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You are not logged in, redirecting...",
    });
  }
  return next({
    ctx: { ...ctx, user: ctx.user },
  });
});

// It is not unstable - only the API might change in the future: https://trpc.io/docs/faq#unstable
const hasOrgSlug = isUserAuthenticated.unstable_pipe(({ next, ctx }) => {
  const userId = ctx.user?.id;
  const orgContext: OrgContext = ctx.org;
  if (!ctx.org || !orgContext) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid organization selected, redirecting...",
    });
  }
  const orgMembership = orgContext.members.find(
    (member) => member.userId === userId
  );

  if (!userId || !orgMembership) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You are not a member of this organization, redirecting...",
    });
  }

  return next({
    ctx: {
      ...ctx,
      org: {
        ...ctx.org,
        memberId: orgMembership.id,
      },
    },
  });
});

// const turnstileTokenValidation = experimental_standaloneMiddleware<{
//   input: { turnstileToken: string }; // defaults to 'unknown' if not defined
// }>().create(async (opts) => {
//   if (!useRuntimeConfig().public.turnstileEnabled) return opts.next();
//   if (!opts.input.turnstileToken) {
//     if (process.env.NODE_ENV === "development") return opts.next();
//     throw new TRPCError({
//       code: "FORBIDDEN",
//       message: "Missing Turnstile Verification Token",
//     });
//   }

//   const token = await verifyTurnstileToken(opts.input.turnstileToken);
//   if (!token.success)
//     throw new TRPCError({
//       code: "BAD_REQUEST",
//       message: "Invalid Turnstile Verification Token",
//     });

//   return opts.next();
// });

export const publicProcedure = trpcContext.procedure;
export const limitedProcedure = trpcContext.procedure;
export const userProcedure = trpcContext.procedure.use(isUserAuthenticated);
export const orgProcedure = trpcContext.procedure.use(hasOrgSlug);

export const router = trpcContext.router;
export const middleware = trpcContext.middleware;
