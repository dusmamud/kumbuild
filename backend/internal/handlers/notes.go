package handlers

import (
	"net/http"
	"strings"

	"github.com/dusmamud/kumbuild/backend/internal/middleware"
	"github.com/dusmamud/kumbuild/backend/internal/store"
	"github.com/go-chi/chi/v5"
)

// CreateOrderNote adds an internal note to an order (admin,
// customer_service or super_admin).
//
// NOTE: the orders table does NOT exist yet (Phases 4-6), so NO existence
// check is possible — the note is inserted as-is against the URL order id.
func (h *Handler) CreateOrderNote(w http.ResponseWriter, r *http.Request) {
	author := currentUser(r)
	if author == nil {
		middleware.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	orderID := chi.URLParam(r, "id")
	var req struct {
		Note string `json:"note"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	note := strings.TrimSpace(req.Note)
	switch {
	case note == "":
		writeValidationError(w, map[string]string{"note": "required"})
		return
	case len([]rune(note)) > 5000:
		writeValidationError(w, map[string]string{"note": "too-long"})
		return
	}
	n := &store.OrderNote{OrderID: orderID, AuthorUserID: author.ID, Note: note}
	if err := h.Notes.Create(r.Context(), n); err != nil {
		writeInternal(w, r, err, "notes: create failed")
		return
	}
	middleware.WriteJSON(w, http.StatusCreated, map[string]any{"note": n})
}

// ListOrderNotes lists an order's notes, latest first, paginated.
// The note store returns no total, so this response has no "pages".
func (h *Handler) ListOrderNotes(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "id")
	page, limit := pageParams(r)
	notes, err := h.Notes.ListByOrder(r.Context(), orderID, limit, (page-1)*limit)
	if err != nil {
		writeInternal(w, r, err, "notes: list failed")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]any{
		"notes": notes, "page": page, "limit": limit,
	})
}
