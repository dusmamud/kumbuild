package auth

import (
	"strings"
	"testing"
)

func TestValidateEmail(t *testing.T) {
	valid := []string{"a@b.com", "dus.mamud+tag@example.co.in", "x@y.io"}
	for _, e := range valid {
		if !ValidateEmail(e) {
			t.Errorf("Valid email rejected: %q", e)
		}
	}
	invalid := []string{"", "plain", "a@", "@b.com", "a b@c.com", "a@b", strings.Repeat("a", 250) + "@b.com"}
	for _, e := range invalid {
		if ValidateEmail(e) {
			t.Errorf("Invalid email accepted: %q", e)
		}
	}
}

func TestValidatePhones(t *testing.T) {
	if !ValidateE164("+919876543210") || !ValidateE164("+14155552671") {
		t.Fatal("valid E.164 numbers rejected")
	}
	for _, bad := range []string{"919876543210", "+91", "+012345678", "+91987654321a", ""} {
		if ValidateE164(bad) {
			t.Errorf("invalid E.164 accepted: %q", bad)
		}
	}
	if !ValidateIndianPhone("+919876543210") || !ValidateIndianPhone("+916123456789") {
		t.Fatal("valid Indian mobiles rejected")
	}
	// Typed forms (trunk 0, bare country code, spaces) are accepted too.
	for _, ok := range []string{"9876543210", "09876543210", "919876543210", "+91 98765 43210", "0091-98765-43210"} {
		if !ValidateIndianPhone(ok) {
			t.Errorf("typed-form Indian mobile rejected: %q", ok)
		}
	}
	for _, bad := range []string{"+91987654321", "+911234567890", "+915876543210", "+14155552671", "+9198765432100"} {
		if ValidateIndianPhone(bad) {
			t.Errorf("invalid Indian phone accepted: %q", bad)
		}
	}
}

func TestNormalizeIndianMobile(t *testing.T) {
	valid := map[string]string{
		"9876543210":        "+919876543210",
		"98765 43210":       "+919876543210",
		"+919876543210":     "+919876543210",
		"+91 98765 43210":   "+919876543210",
		"+91-98765-43210":   "+919876543210",
		"09876543210":       "+919876543210",
		"098765 43210":      "+919876543210",
		"(098765) 43210":    "+919876543210",
		"919876543210":      "+919876543210",
		"91 98765 43210":    "+919876543210",
		"00919876543210":    "+919876543210",
		"0091 98765 43210":  "+919876543210",
		"6123456789":        "+916123456789",
		"9198765432":        "+919198765432", // 10-digit number starting with 91 is NOT a country code
		"  +919876543210  ": "+919876543210",
	}
	for in, want := range valid {
		if got, ok := NormalizeIndianMobile(in); !ok || got != want {
			t.Errorf("NormalizeIndianMobile(%q) = %q, %v; want %q, true", in, got, ok, want)
		}
	}
	invalid := []string{
		"", "   ", "5876543210", // starts with 5
		"1234567890",      // starts with 1
		"987654321",       // 9 digits
		"98765432109",     // 11 digits, no trunk 0
		"91987654321",     // country code + 9 digits
		"+91987654321",    // +91 + 9 digits
		"+9198765432100",  // +91 + 11 digits
		"0091987654321",   // 0091 + 9 digits
		"+14155552671",    // non-Indian
		"+91987654321a",   // letter
		"abcdefghij",      // letters
		"+91 58765 43210", // Indian shape, starts with 5
		"0987654321",      // trunk 0 + 9 digits
	}
	for _, in := range invalid {
		if got, ok := NormalizeIndianMobile(in); ok {
			t.Errorf("NormalizeIndianMobile(%q) = %q, true; want invalid", in, got)
		}
	}
}

func TestNormalizeWhatsApp(t *testing.T) {
	valid := map[string]string{
		"+919876543210":   "+919876543210",
		"+91 98765 43210": "+919876543210",
		"09876543210":     "+919876543210",
		"9876543210":      "+919876543210", // Indian number, bare national form
		"+14155552671":    "+14155552671",  // non-Indian strict E.164
		"+442071234567":   "+442071234567",
	}
	for in, want := range valid {
		if got, ok := NormalizeWhatsApp(in); !ok || got != want {
			t.Errorf("NormalizeWhatsApp(%q) = %q, %v; want %q, true", in, got, ok, want)
		}
	}
	for _, bad := range []string{"", "12345", "+012345678", "+91", "5876543210", "+1 415 555 2671"} {
		if got, ok := NormalizeWhatsApp(bad); ok {
			t.Errorf("NormalizeWhatsApp(%q) = %q, true; want invalid", bad, got)
		}
	}
}

func TestValidateGSTINAndPincode(t *testing.T) {
	if !ValidateGSTIN("27ABCDE1234F1Z5") {
		t.Fatal("valid GSTIN rejected")
	}
	for _, bad := range []string{"27abcde1234f1z5", "27ABCDE1234F1Z", "27ABCDE1234F1Z55", "ABCD1234F1Z5"} {
		if ValidateGSTIN(bad) {
			t.Errorf("invalid GSTIN accepted: %q", bad)
		}
	}
	if !ValidatePincode("400001") {
		t.Fatal("valid pincode rejected")
	}
	for _, bad := range []string{"040001", "40001", "4000011", "40000a"} {
		if ValidatePincode(bad) {
			t.Errorf("invalid pincode accepted: %q", bad)
		}
	}
}

func TestValidateFullName(t *testing.T) {
	if !ValidateFullName("Dus Mamud") || !ValidateFullName("  A  ") {
		t.Fatal("valid names rejected")
	}
	if ValidateFullName("") || ValidateFullName("   ") || ValidateFullName(strings.Repeat("x", 101)) {
		t.Fatal("invalid names accepted")
	}
}

func validSignup() SignupInput {
	return SignupInput{
		FullName: "Dus Mamud", Email: "dus@example.com", Password: "Str0ng!Pass",
		PhoneNo: "+919876543210", WhatsAppNo: "+919876543210",
		HasBilling: true, BillingName: "Dus Mamud", AddressLine1: "1 Main Rd",
		City: "Mumbai", State: "Maharashtra", Pincode: "400001", Country: "India",
	}
}

func TestValidateSignupInputValid(t *testing.T) {
	if errs := ValidateSignupInput(validSignup()); len(errs) != 0 {
		t.Fatalf("valid signup rejected: %v", errs)
	}
	// Staff creation: no billing, no alt email — still valid.
	in := validSignup()
	in.HasBilling = false
	if errs := ValidateSignupInput(in); len(errs) != 0 {
		t.Fatalf("staff signup rejected: %v", errs)
	}
	// Alt email + GSTIN provided and valid.
	in = validSignup()
	in.AlternativeEmail = "alt@example.com"
	in.GSTIN = "27ABCDE1234F1Z5"
	if errs := ValidateSignupInput(in); len(errs) != 0 {
		t.Fatalf("signup with alt email/GSTIN rejected: %v", errs)
	}
	// Messy typed phone forms validate, and normalise to E.164.
	in = validSignup()
	in.PhoneNo = "098765 43210"
	in.WhatsAppNo = "+91 98765 43210"
	if errs := ValidateSignupInput(in); len(errs) != 0 {
		t.Fatalf("signup with typed-form phones rejected: %v", errs)
	}
	if got := in.NormalizedPhone(); got != "+919876543210" {
		t.Fatalf("NormalizedPhone = %q", got)
	}
	if got := in.NormalizedWhatsApp(); got != "+919876543210" {
		t.Fatalf("NormalizedWhatsApp = %q", got)
	}
}

func TestValidateSignupInputInvalid(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*SignupInput)
		field  string
		code   string
	}{
		{"empty name", func(i *SignupInput) { i.FullName = " " }, "full_name", CodeInvalidName},
		{"bad email", func(i *SignupInput) { i.Email = "nope" }, "email", CodeInvalidEmail},
		{"missing email", func(i *SignupInput) { i.Email = "" }, "email", CodeRequired},
		{"weak password", func(i *SignupInput) { i.Password = "weakpass" }, "password", CodeWeakPassword},
		{"bad phone", func(i *SignupInput) { i.PhoneNo = "+14155552671" }, "phone_no", CodeInvalidPhone},
		{"bad whatsapp", func(i *SignupInput) { i.WhatsAppNo = "+012345678" }, "whatsapp_no", CodeInvalidWhatsApp},
		{"bad alt email", func(i *SignupInput) { i.AlternativeEmail = "nope" }, "alternative_email", CodeInvalidAltEmail},
		{"alt same as primary", func(i *SignupInput) { i.AlternativeEmail = "DUS@example.com" }, "alternative_email", CodeAltEmailSameAsPrimary},
		{"missing city", func(i *SignupInput) { i.City = "" }, "city", CodeRequired},
		{"bad pincode", func(i *SignupInput) { i.Pincode = "123" }, "pincode", CodeInvalidPincode},
		{"bad gstin", func(i *SignupInput) { i.GSTIN = "BAD" }, "gstin", CodeInvalidGSTIN},
	}
	for _, c := range cases {
		in := validSignup()
		c.mutate(&in)
		errs := ValidateSignupInput(in)
		if errs[c.field] != c.code {
			t.Errorf("%s: field %s = %q, want %q (all errs: %v)", c.name, c.field, errs[c.field], c.code, errs)
		}
	}
	// Billing fields are NOT validated for staff creation.
	in := validSignup()
	in.HasBilling = false
	in.City = ""
	in.Pincode = "bad"
	if errs := ValidateSignupInput(in); len(errs) != 0 {
		t.Fatalf("staff creation must skip billing validation: %v", errs)
	}
}
