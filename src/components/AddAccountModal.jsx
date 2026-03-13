function AddAccountModal({
    isOpen,
    closeAddAccountModal,
    onAddAccount,
    addAccountForm,
    setAddAccountForm,
    addingAccount,
}) {
    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" onClick={closeAddAccountModal}>
            <section className="modal-card" onClick={(event) => event.stopPropagation()}>
                <div className="modal-header">
                    <h2>Add account / card / wallet</h2>
                    <button className="icon-close" onClick={closeAddAccountModal}>
                        ×
                    </button>
                </div>

                <form onSubmit={onAddAccount} className="editor-form">
                    <label>
                        Name
                        <input
                            value={addAccountForm.bank}
                            onChange={(event) => setAddAccountForm((prev) => ({ ...prev, bank: event.target.value }))}
                            placeholder="e.g. DBS Visa, Cash Wallet"
                            required
                        />
                    </label>

                    <label>
                        Identifier (optional)
                        <input
                            value={addAccountForm.identifier}
                            onChange={(event) =>
                                setAddAccountForm((prev) => ({ ...prev, identifier: event.target.value }))
                            }
                            placeholder="e.g. **** 1234"
                        />
                    </label>

                    <div className="actions">
                        <button type="button" className="ghost" onClick={closeAddAccountModal}>
                            Cancel
                        </button>
                        <button type="submit" disabled={addingAccount}>
                            {addingAccount ? "Adding..." : "Add"}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}

export default AddAccountModal;
