package auth

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

// GenerateOTP returns a 6-digit, zero-padded, crypto-random OTP code.
func GenerateOTP() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", fmt.Errorf("generate OTP: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// HashOTP returns the SHA-256 hex of an OTP code. The plaintext code is
// never stored — only the hash, like every other token.
func HashOTP(code string) string { return HashToken(code) }
