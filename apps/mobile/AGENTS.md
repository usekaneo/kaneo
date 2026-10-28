# Kaneo Mobile

Expo and React Native app for Android and iOS. The repository guide in `../../AGENTS.md` applies; this file adds what is specific to the app.

## Expo has changed: do not trust your training data

Expo ships breaking changes every SDK release. Before writing code that touches an Expo, EAS, or React Native API, read the `expo` major version in `package.json` and check the matching docs at `https://docs.expo.dev/versions/v<major>.0.0/`. For anything else, start from https://docs.expo.dev/llms.txt.

## Commands

Run from the repository root. Add native libraries with `pnpm --filter @kaneo/mobile exec expo install <package>`, never with `pnpm add`, so versions match the SDK.

```bash
pnpm --filter @kaneo/mobile android     # build and run a development build
pnpm --filter @kaneo/mobile ios
pnpm --filter @kaneo/mobile lint
pnpm --filter @kaneo/mobile typecheck
pnpm --filter @kaneo/mobile test
pnpm --filter @kaneo/mobile exec expo-doctor
```

## Rules

- Keep Android and iOS in step. Check `Platform.OS` branches, keyboard handling, safe areas, and shadows (`shadow*` for iOS, `elevation` for Android) on both.
- Routes live in `src/app/` and use Expo Router; keep non-route code outside it.
- `ios/` and `android/` are generated and ignored. Configure native behavior in `app.json` or a config plugin in `plugins/`; never edit generated native files.
- After adding a library with native code, the app needs a new development build.
- The app talks to the API over HTTP with its own types in `src/lib/api/`. When an API route or response the app uses changes, update those types and the calls in `src/lib/api/endpoints.ts`.
- Keep pure helpers free of React Native imports so they can be unit-tested with Vitest, and put tests beside them.
- User-facing copy lives in the shared catalog under the `mobile` namespace of `../../i18n/en-US.json`. Use `t("mobile:…")` from `useTranslation(["mobile"])` in components (the array form is what lets the prefixed keys type-check), and `i18n.t` from `@/lib/i18n` at call time in plain modules. Keys are type-checked against `en-US.json`. Format dates and numbers with `currentLocale()`.
