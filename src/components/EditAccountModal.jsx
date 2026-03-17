function EditAccountModal({
  selectedAccount,
  closeEditAccountModal,
  onSaveAccount,
  editAccountForm,
  setEditAccountForm,
  savingAccount = false,
}) {
  if (!selectedAccount) return null;

  return (
    <div className="modal-backdrop" onClick={closeEditAccountModal}>
      <section className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Account Nickname</h2>
          <button className="icon-close" onClick={closeEditAccountModal}>
            ×
          </button>
        </div>

        <form onSubmit={onSaveAccount} className="editor-form">
          <label>
            Nickname
            <input
              value={editAccountForm.nickname}
              onChange={(event) => setEditAccountForm((prev) => ({ ...prev, nickname: event.target.value }))}
              placeholder="e.g. Travel Card, Main Wallet"
              maxLength={32}
              required
            />
          </label>

          <div className="actions">
            <button type="button" className="ghost" onClick={closeEditAccountModal}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {savingAccount ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default EditAccountModal;

