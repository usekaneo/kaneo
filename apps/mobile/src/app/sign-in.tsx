import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import {
  ArrowUpRight,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Key,
  Link2,
  Mail,
  RotateCcwClock,
  Server,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { KaneoLogo } from "@/components/brand";
import { BackButton, Screen } from "@/components/screen";
import { Txt } from "@/components/text";
import { useToast } from "@/components/toast";
import { Button, Segmented, TextField, Touch } from "@/components/ui";
import { CLOUD_URL, normalizeServerUrl, userMessage } from "@/lib/api/client";
import type { DeviceCodeResponse, InstanceConfig } from "@/lib/api/types";
import * as auth from "@/lib/auth";
import { usePrefs } from "@/lib/session";
import { font, useColors } from "@/theme";

type Step = "start" | "otp" | "device" | "apiKey" | "signUp";

const CODE_SLOTS = [0, 1, 2, 3, 4, 5];

function friendly(e: unknown): string {
  const text = userMessage(e);
  if (/captcha/i.test(text))
    return "This server requires a browser check for this step. Use “Continue in browser” instead.";
  if (/invalid_client/i.test(text)) {
    return "This server doesn’t allow device sign-in. Ask its admin to add “kaneo-cli” to DEVICE_AUTH_CLIENT_IDS, or sign in with a password or API key.";
  }
  return text;
}

export default function SignInScreen() {
  const prefs = usePrefs();
  const [mode, setMode] = useState<"cloud" | "self">(
    prefs.lastServerUrl && prefs.lastServerUrl !== CLOUD_URL ? "self" : "cloud",
  );
  const [serverUrl, setServerUrl] = useState<string | null>(
    mode === "cloud" ? CLOUD_URL : null,
  );
  const [config, setConfig] = useState<InstanceConfig | null>(null);
  const [step, setStep] = useState<Step>("start");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [deviceAttempt, setDeviceAttempt] = useState(0);

  const run = async (block: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await block();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setLoading(false);
    }
  };

  const connect = (raw: string) =>
    run(async () => {
      const url = normalizeServerUrl(raw);
      const cfg = await auth.probe(url);
      setServerUrl(url);
      setConfig(cfg);
    });

  // A slow cloud probe must not land after switching to self-hosted.
  const modeRef = useRef(mode);
  const probeCloud = () => {
    const apply = (cfg: InstanceConfig) =>
      modeRef.current === "cloud" && setConfig(cfg);
    void auth.probe(CLOUD_URL).then(apply, () => apply({ isCloud: true }));
  };
  const changeMode = (next: "cloud" | "self") => {
    modeRef.current = next;
    setMode(next);
    setError(null);
    setConfig(null);
    setServerUrl(next === "cloud" ? CLOUD_URL : null);
    if (next === "cloud") probeCloud();
  };
  // Kaneo Cloud needs no address; check its sign-in options right away.
  const [initialMode] = useState(mode);
  useEffect(() => {
    if (initialMode !== "cloud") return;
    const apply = (cfg: InstanceConfig) =>
      modeRef.current === "cloud" && setConfig(cfg);
    void auth.probe(CLOUD_URL).then(apply, () => apply({ isCloud: true }));
  }, [initialMode]);

  const back = () => {
    setError(null);
    setStep("start");
  };

  return (
    <Screen surface>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {step !== "start" ? (
          <View
            style={{ height: 52, justifyContent: "center", paddingLeft: 6 }}
          >
            <BackButton onPress={back} />
          </View>
        ) : null}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingBottom: 36,
          }}
        >
          {step === "start" ? (
            <StartStep
              mode={mode}
              setMode={changeMode}
              serverUrl={serverUrl}
              config={config}
              loading={loading}
              error={error}
              onConnect={connect}
              onChangeServer={() => {
                setServerUrl(null);
                setConfig(null);
              }}
              onSignIn={(email, password) =>
                run(() => auth.signInWithPassword(serverUrl!, email, password))
              }
              onCode={(email) => {
                if (!email.trim()) {
                  setOtpEmail("");
                  setStep("otp");
                  return;
                }
                void run(async () => {
                  await auth.sendOtp(serverUrl!, email);
                  setOtpEmail(email.trim());
                  setStep("otp");
                });
              }}
              onDevice={() => {
                setError(null);
                setStep("device");
              }}
              onApiKey={() => {
                setError(null);
                setStep("apiKey");
              }}
              onSignUp={() => {
                if (config?.isCloud)
                  void WebBrowser.openBrowserAsync(`${serverUrl}/auth/sign-up`);
                else setStep("signUp");
              }}
            />
          ) : null}
          {step === "otp" && serverUrl ? (
            <OtpStep
              serverUrl={serverUrl}
              email={otpEmail}
              setEmail={setOtpEmail}
              loading={loading}
              error={error}
              onVerify={(code) =>
                run(() => auth.signInWithOtp(serverUrl, otpEmail, code))
              }
              onResend={() => run(() => auth.sendOtp(serverUrl, otpEmail))}
            />
          ) : null}
          {step === "device" && serverUrl ? (
            <DeviceStep
              key={deviceAttempt}
              serverUrl={serverUrl}
              onRetry={() => setDeviceAttempt((a) => a + 1)}
            />
          ) : null}
          {step === "apiKey" && serverUrl ? (
            <ApiKeyStep
              loading={loading}
              error={error}
              onSubmit={(key) =>
                run(() =>
                  auth.completeWithToken(serverUrl, key.trim(), "apiKey"),
                )
              }
            />
          ) : null}
          {step === "signUp" && serverUrl ? (
            <SignUpStep
              loading={loading}
              error={error}
              onSubmit={(name, email, password) =>
                run(() => auth.signUp(serverUrl, name, email, password))
              }
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <Txt variant="meta" tone="danger" style={{ lineHeight: 18 }}>
      {error}
    </Txt>
  );
}

function StartStep(props: {
  mode: "cloud" | "self";
  setMode: (m: "cloud" | "self") => void;
  serverUrl: string | null;
  config: InstanceConfig | null;
  loading: boolean;
  error: string | null;
  onConnect: (url: string) => void;
  onChangeServer: () => void;
  onSignIn: (email: string, password: string) => void;
  onCode: (email: string) => void;
  onDevice: () => void;
  onApiKey: () => void;
  onSignUp: () => void;
}) {
  const c = useColors();
  const prefs = usePrefs();
  const { mode, serverUrl, config } = props;
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const recent = prefs.recentServers.filter((s) => s !== CLOUD_URL);
  const connected = !!serverUrl && (mode === "cloud" || !!config);
  const loginForm = !config?.disableLoginForm;
  const canCode = !config?.disableEmailOtpSignIn;
  const canRegister =
    !config?.disableRegistration && !config?.disablePasswordRegistration;

  return (
    <View style={{ gap: 28, paddingTop: 56, flexGrow: 1 }}>
      <View style={{ gap: 12 }}>
        <KaneoLogo height={34} />
        <Txt variant="body" tone="muted" style={{ lineHeight: 22 }}>
          Simple project management. Connect to Kaneo Cloud or your own
          instance.
        </Txt>
      </View>

      <Segmented
        value={mode}
        onChange={props.setMode}
        options={[
          { value: "cloud", label: "Kaneo Cloud" },
          { value: "self", label: "Self-hosted" },
        ]}
      />

      {mode === "self" && !config ? (
        <View style={{ gap: 28 }}>
          <View style={{ gap: 12 }}>
            <TextField
              label="Server address"
              value={address}
              onChangeText={setAddress}
              placeholder="kaneo.example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              mono
              leading={<Server size={16} color={c.muted} strokeWidth={2} />}
              hint="The address you open Kaneo at. Use http:// for servers without TLS. If the API runs on another host, enter the API address."
              returnKeyType="go"
              onSubmitEditing={() => address.trim() && props.onConnect(address)}
            />
            <ErrorText error={props.error} />
            <Button
              label="Connect"
              disabled={!address.trim()}
              loading={props.loading}
              onPress={() => props.onConnect(address)}
            />
          </View>
          {recent.length ? (
            <View style={{ gap: 8 }}>
              <Txt variant="caption" weight="medium" tone="muted">
                Recent
              </Txt>
              {recent.map((url) => (
                <Touch
                  key={url}
                  onPress={() => props.onConnect(url)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    height: 48,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: c.hairline,
                  }}
                >
                  <RotateCcwClock size={16} color={c.faint} strokeWidth={2} />
                  <Txt variant="monoMd" style={{ flex: 1 }} numberOfLines={1}>
                    {url.replace(/^https:\/\//, "")}
                  </Txt>
                  <ChevronRight size={16} color={c.placeholder} />
                </Touch>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {connected ? (
        <View style={{ gap: 28 }}>
          {mode === "self" ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <Server size={14} color={c.muted} strokeWidth={2} />
              <Txt
                variant="monoMd"
                tone="ink2"
                style={{ flex: 1 }}
                numberOfLines={1}
              >
                {serverUrl!.replace(/^https?:\/\//, "")}
              </Txt>
              <Touch onPress={props.onChangeServer} hitSlop={8}>
                <Txt variant="meta" weight="medium" tone="muted">
                  Change
                </Txt>
              </Touch>
            </View>
          ) : null}

          {loginForm ? (
            <View style={{ gap: 12 }}>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              <TextField
                ref={passwordRef}
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                returnKeyType="go"
                onSubmitEditing={() =>
                  email && password && props.onSignIn(email, password)
                }
                trailing={
                  <Touch
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={10}
                    accessibilityLabel="Toggle password visibility"
                  >
                    {showPassword ? (
                      <EyeOff size={18} color={c.faint} />
                    ) : (
                      <Eye size={18} color={c.faint} />
                    )}
                  </Touch>
                }
              />
              <ErrorText error={props.error} />
              <Button
                label="Sign in"
                disabled={!email.trim() || !password}
                loading={props.loading}
                onPress={() => props.onSignIn(email, password)}
              />
            </View>
          ) : (
            <ErrorText error={props.error} />
          )}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: c.divider }} />
            <Txt variant="caption" tone="faint">
              or
            </Txt>
            <View style={{ flex: 1, height: 1, backgroundColor: c.divider }} />
          </View>

          <View style={{ gap: 8 }}>
            <AltOption
              icon={<Globe size={18} color={c.ink} strokeWidth={2} />}
              title="Continue in browser"
              hint="GitHub, Google, Discord or SSO"
              onPress={props.onDevice}
            />
            {canCode ? (
              <AltOption
                icon={<Mail size={18} color={c.ink} strokeWidth={2} />}
                title="Email me a sign-in code"
                hint={
                  email.trim()
                    ? `Send to ${email.trim()}`
                    : "No password needed"
                }
                onPress={() => props.onCode(email)}
              />
            ) : null}
            <AltOption
              icon={<Key size={18} color={c.ink} strokeWidth={2} />}
              title="Use an API key"
              onPress={props.onApiKey}
            />
          </View>

          {canRegister ? (
            <Touch
              onPress={props.onSignUp}
              style={{
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
                paddingTop: 4,
              }}
            >
              <Txt variant="bodySm" tone="muted">
                New to Kaneo?
              </Txt>
              <Txt variant="bodySm" weight="semibold">
                Create account
              </Txt>
            </Touch>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function AltOption({
  icon,
  title,
  hint,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Touch
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 52,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.hairline,
      }}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <Txt variant="body" weight="medium">
          {title}
        </Txt>
        {hint ? (
          <Txt variant="caption" tone="faint">
            {hint}
          </Txt>
        ) : null}
      </View>
      <ChevronRight size={16} color={c.placeholder} />
    </Touch>
  );
}

function StepTitle({ title, message }: { title: string; message?: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt variant="title">{title}</Txt>
      {message ? (
        <Txt variant="body" tone="muted" style={{ lineHeight: 22 }}>
          {message}
        </Txt>
      ) : null}
    </View>
  );
}

function OtpStep({
  email,
  setEmail,
  loading,
  error,
  onVerify,
  onResend,
}: {
  serverUrl: string;
  email: string;
  setEmail: (v: string) => void;
  loading: boolean;
  error: string | null;
  onVerify: (code: string) => void;
  onResend: () => void;
}) {
  const c = useColors();
  const [code, setCode] = useState("");
  const [draftEmail, setDraftEmail] = useState(email);
  const input = useRef<TextInput>(null);
  const hasEmail = !!email;

  if (!hasEmail) {
    return (
      <View style={{ gap: 28, paddingTop: 20 }}>
        <StepTitle
          title="Sign in with a code"
          message="We'll email you a 6-digit code. No password needed."
        />
        <TextField
          label="Email"
          value={draftEmail}
          onChangeText={setDraftEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoFocus
        />
        <ErrorText error={error} />
        <Button
          label="Send code"
          disabled={!draftEmail.trim()}
          loading={loading}
          onPress={() => {
            setEmail(draftEmail.trim());
            onResend();
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: 28, paddingTop: 20 }}>
      <StepTitle
        title="Check your email"
        message={`We sent a 6-digit code to ${email}`}
      />
      <Touch
        onPress={() => input.current?.focus()}
        style={{ flexDirection: "row", gap: 8 }}
      >
        {CODE_SLOTS.map((slot) => {
          const active = slot === Math.min(code.length, 5);
          return (
            <View
              key={slot}
              style={{
                flex: 1,
                height: 56,
                borderRadius: 10,
                borderWidth: active ? 1.5 : 1,
                borderColor: active ? c.ink : c.fillStrong,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Txt style={{ fontFamily: font.monoMedium, fontSize: 24 }}>
                {code[slot]}
              </Txt>
            </View>
          );
        })}
      </Touch>
      <TextInput
        ref={input}
        value={code}
        onChangeText={(v) => {
          const clean = v.replace(/\D/g, "").slice(0, 6);
          setCode(clean);
          if (clean.length === 6) onVerify(clean);
        }}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoFocus
        style={{ position: "absolute", opacity: 0, height: 1, width: 1 }}
      />
      <ErrorText error={error} />
      <Button
        label="Verify"
        disabled={code.length < 6}
        loading={loading}
        onPress={() => onVerify(code)}
      />
      <Touch
        onPress={onResend}
        style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}
      >
        <Txt variant="bodySm" tone="muted">
          Didn’t get it?
        </Txt>
        <Txt variant="bodySm" weight="semibold">
          Resend code
        </Txt>
      </Touch>
    </View>
  );
}

function DeviceStep({
  serverUrl,
  onRetry,
}: {
  serverUrl: string;
  onRetry: () => void;
}) {
  const c = useColors();
  const toast = useToast();
  const [device, setDevice] = useState<DeviceCodeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const code = await auth.startDeviceLogin(serverUrl);
        if (cancelled) return;
        setDevice(code);
        let interval = Math.max(1, code.interval ?? 5);
        const deadline = Date.now() + (code.expires_in ?? 900) * 1000;
        while (!cancelled && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, interval * 1000));
          if (cancelled) return;
          let result: auth.DevicePoll;
          try {
            result = await auth.pollDeviceLogin(serverUrl, code.device_code);
          } catch (e) {
            if (/device sign-in failed|invalid/i.test(userMessage(e))) throw e;
            result = { kind: "pending" };
          }
          if (result.kind === "approved") {
            await auth.completeWithToken(serverUrl, result.token);
            return;
          }
          if (result.kind === "slowDown") interval += 5;
          if (result.kind === "denied")
            throw new Error("Sign-in was denied in the browser.");
          if (result.kind === "expired") break;
        }
        if (!cancelled)
          throw new Error(
            "The sign-in code expired. Start again to get a new one.",
          );
      } catch (e) {
        if (!cancelled) setError(friendly(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serverUrl]);

  const link = device?.verification_uri_complete ?? device?.verification_uri;

  return (
    <View style={{ gap: 28, paddingTop: 20 }}>
      <StepTitle
        title="Continue in browser"
        message="Approve this device from the Kaneo website. GitHub, Google, Discord and SSO all work there."
      />
      <View
        style={{
          alignItems: "center",
          gap: 14,
          paddingVertical: 24,
          paddingHorizontal: 20,
          borderRadius: 14,
          backgroundColor: c.ground,
          borderWidth: 1,
          borderColor: c.hairline,
        }}
      >
        <Txt variant="caption" weight="medium" tone="muted">
          Your code
        </Txt>
        <Txt
          style={{
            fontFamily: font.monoMedium,
            fontSize: 34,
            lineHeight: 40,
            letterSpacing: 2.5,
          }}
        >
          {device?.user_code ?? "········"}
        </Txt>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            label="Copy code"
            kind="secondary"
            size="sm"
            disabled={!device}
            icon={<Copy size={14} color={c.ink2} />}
            onPress={() =>
              device &&
              Clipboard.setStringAsync(device.user_code).then(() =>
                toast.show("Code copied", "success"),
              )
            }
          />
          <Button
            label="Copy link"
            kind="secondary"
            size="sm"
            disabled={!link}
            icon={<Link2 size={14} color={c.ink2} />}
            onPress={() =>
              link &&
              Clipboard.setStringAsync(link).then(() =>
                toast.show("Link copied", "success"),
              )
            }
          />
        </View>
      </View>
      <Button
        label="Open browser"
        disabled={!link}
        icon={
          <ArrowUpRight
            size={16}
            color={link ? c.onPrimary : c.placeholder}
            strokeWidth={2}
          />
        }
        onPress={() => link && WebBrowser.openBrowserAsync(link)}
        style={{ flexDirection: "row-reverse" }}
      />
      {error ? (
        <View style={{ gap: 12 }}>
          <ErrorText error={error} />
          <Button label="Try again" kind="secondary" onPress={onRetry} />
        </View>
      ) : (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: c.warningFg,
            }}
          />
          <Txt variant="bodySm" tone="muted">
            {device ? "Waiting for approval…" : "Getting a code…"}
          </Txt>
        </View>
      )}
    </View>
  );
}

function ApiKeyStep({
  loading,
  error,
  onSubmit,
}: {
  loading: boolean;
  error: string | null;
  onSubmit: (key: string) => void;
}) {
  const c = useColors();
  const [key, setKey] = useState("");
  return (
    <View style={{ gap: 28, paddingTop: 20 }}>
      <StepTitle
        title="Use an API key"
        message="Create one on the web under Settings, then API keys. It works even when other sign-in methods are turned off."
      />
      <TextField
        label="API key"
        value={key}
        onChangeText={setKey}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        mono
        autoFocus
        leading={<Key size={16} color={c.muted} strokeWidth={2} />}
      />
      <ErrorText error={error} />
      <Button
        label="Sign in"
        disabled={!key.trim()}
        loading={loading}
        onPress={() => onSubmit(key)}
      />
    </View>
  );
}

function SignUpStep({
  loading,
  error,
  onSubmit,
}: {
  loading: boolean;
  error: string | null;
  onSubmit: (name: string, email: string, password: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <View style={{ gap: 20, paddingTop: 20 }}>
      <StepTitle title="Create account" />
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        autoComplete="name"
        autoFocus
      />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        hint="At least 8 characters"
      />
      <ErrorText error={error} />
      <Button
        label="Create account"
        disabled={!name.trim() || !email.trim() || password.length < 8}
        loading={loading}
        onPress={() => onSubmit(name, email, password)}
      />
    </View>
  );
}
