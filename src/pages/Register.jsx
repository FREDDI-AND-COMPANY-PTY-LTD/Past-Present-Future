import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2, User, ShieldCheck, GitBranch } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "@/components/ui/use-toast";

export default function Register() {
  const [givenNames, setGivenNames] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [unclaimedAncestors, setUnclaimedAncestors] = useState([]);
  const [claimedAncestorId, setClaimedAncestorId] = useState("");

  useEffect(() => {
    base44.entities.Ancestor.list('full_name')
      .then((all) => {
        setUnclaimedAncestors((all || []).filter(a => !a.user_account_id));
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!givenNames.trim() || !familyName.trim()) {
      setError("Please enter your given names and family name as they appear on your birth certificate");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.register({ email, password });
      setShowOtp(true);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
        const capitalGiven = givenNames.trim().toUpperCase();
        const capitalFamily = familyName.trim().toUpperCase();
        const fullName = `${givenNames.trim()} ${capitalFamily}`.trim();
        // Persist the birth-certificate-style name: given names + CAPITALISED family name
        await base44.auth.updateMe({
          given_names: capitalGiven,
          family_name: capitalFamily,
        }).catch(() => {});

        const userId = result.user_id || (await base44.auth.me())?.id;

        // If claiming an unclaimed ancestor placeholder, link this user to that profile
        let ancestorId = claimedAncestorId;
        if (ancestorId) {
          await base44.entities.Ancestor.update(ancestorId, {
            user_account_id: userId,
            full_name: fullName,
            living: true,
          }).catch(() => {});
        } else {
          // Create a new ancestor profile for this user
          const newAncestor = await base44.entities.Ancestor.create({
            full_name: fullName,
            living: true,
          }).catch(() => {});
          if (newAncestor?.id) ancestorId = newAncestor.id;
        }

        // Register hearsay sources for the name fields — subject to document validation
        if (ancestorId) {
          const me = await base44.auth.me().catch(() => null);
          const providedByName = fullName;
          const baseSource = {
            entity_type: 'Ancestor',
            entity_id: ancestorId,
            source_type: 'hearsay',
            validation_status: 'hearsay',
            provided_by_id: userId,
            provided_by_name: providedByName,
          };
          await base44.entities.Source.create({
            ...baseSource,
            field_name: 'full_name',
            notes: `Self-registered name: ${fullName}`,
          }).catch(() => {});
          await base44.entities.Source.create({
            ...baseSource,
            field_name: 'given_names',
            notes: `Self-registered given names: ${capitalGiven}`,
          }).catch(() => {});
          await base44.entities.Source.create({
            ...baseSource,
            field_name: 'family_name',
            notes: `Self-registered family name: ${capitalFamily}`,
          }).catch(() => {});
        }
      }
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast({
        title: "Code sent",
        description: "Check your email for the new code.",
      });
    } catch (err) {
      setError(err.message || "Failed to resend code");
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", "/");
  };

  if (showOtp) {
    return (
      <AuthLayout
        icon={Mail}
        title="Verify your email"
        subtitle={`We sent a code to ${email}`}
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        <div className="flex justify-center mb-6">
          <InputOTP
            maxLength={6}
            value={otpCode}
            onChange={setOtpCode}
            autoFocus
            autoComplete="one-time-code"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          className="w-full h-12 font-medium"
          onClick={handleVerify}
          disabled={loading || otpCode.length < 6}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify"
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Didn't receive the code?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">
            Resend
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Sign up to get started"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {unclaimedAncestors.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="claimAncestor" className="flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-primary" />
              Claim your Present, Past and Future
            </Label>
            <select
              id="claimAncestor"
              value={claimedAncestorId}
              onChange={(e) => setClaimedAncestorId(e.target.value)}
              className="w-full h-12 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Not listed / I'll create my own —</option>
              {unclaimedAncestors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}{a.birth_date ? ` (b. ${new Date(a.birth_date).getFullYear()})` : ''}{a.bloodline ? ` — ${a.bloodline}` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              If the admin has placed your name in the family tree, select it here to claim your ancestor profile.
            </p>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="givenNames">Given Names</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="givenNames"
              type="text"
              autoComplete="given-name"
              autoFocus
              placeholder="Jason Lewis"
              value={givenNames}
              onChange={(e) => setGivenNames(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">As they appear on your birth certificate</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="familyName">Family / Surname</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="familyName"
              type="text"
              autoComplete="family-name"
              placeholder="FREDDI"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value.toUpperCase())}
              onBlur={() => setFamilyName(familyName.trim().toUpperCase())}
              className="pl-10 h-12 uppercase tracking-wide font-medium"
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">Capitalised as on your birth certificate</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <div className="mt-6 p-4 rounded-lg border border-primary/20 bg-primary/5">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Your data is yours — always</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Your complete family archive is automatically backed up to your own cloud folder every time you log out. When you upgrade to a Branch Member, you'll enter your cloud folder address and your data is continuously safeguarded in a place you control. If you ever leave, you take everything with you — you only lose the interactive social media experience, not your family's history.
            </p>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}