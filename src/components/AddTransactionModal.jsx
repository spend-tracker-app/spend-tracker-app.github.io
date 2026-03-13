function AddTransactionModal({
    isOpen,
    closeAddModal,
    onAdd,
    addForm,
    setAddForm,
    accounts,
    adding,
}) {
    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" onClick={closeAddModal}>
            <section className="modal-card" onClick={(event) => event.stopPropagation()}>
                <div className="modal-header">
                    <h2>Add transaction</h2>
                    <button className="icon-close" onClick={closeAddModal}>
                        ×
                    </button>
                </div>

                <form onSubmit={onAdd} className="editor-form">
                    <label>
                        Account
                        <select
                            value={addForm.account_id}
                            onChange={(event) => setAddForm((prev) => ({ ...prev, account_id: event.target.value }))}
                            required
                        >
                            <option value="">Select an account</option>
                            {accounts.map((account) => (
                                <option key={account.id} value={String(account.id)}>
                                    {account.bank}
                                    {account.identifier ? ` (${account.identifier})` : ""}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Merchant
                        <input
                            value={addForm.merchant}
                            onChange={(event) => setAddForm((prev) => ({ ...prev, merchant: event.target.value }))}
                        />
                    </label>

                    <div className="row-2">
                        <label>
                            Amount
                            <input
                                type="number"
                                step="0.01"
                                value={addForm.amount}
                                onChange={(event) => setAddForm((prev) => ({ ...prev, amount: event.target.value }))}
                                required
                            />
                        </label>

                        <label>
                            Currency
                            <input
                                maxLength={3}
                                value={addForm.currency}
                                onChange={(event) =>
                                    setAddForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
                                }
                                required
                            />
                        </label>
                    </div>

                    <label>
                        Category
                        <input
                            value={addForm.category}
                            onChange={(event) => setAddForm((prev) => ({ ...prev, category: event.target.value }))}
                        />
                    </label>

                    <label>
                        MCC
                        <input
                            value={addForm.mcc_code}
                            onChange={(event) => setAddForm((prev) => ({ ...prev, mcc_code: event.target.value }))}
                        />
                    </label>

                    <label>
                        Timestamp
                        <input
                            type="datetime-local"
                            value={addForm.transaction_timestamp}
                            onChange={(event) =>
                                setAddForm((prev) => ({ ...prev, transaction_timestamp: event.target.value }))
                            }
                            required
                        />
                    </label>

                    <div className="actions">
                        <button type="button" className="ghost" onClick={closeAddModal}>
                            Cancel
                        </button>
                        <button type="submit" disabled={adding || !accounts.length}>
                            {adding ? "Adding..." : "Add transaction"}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}

export default AddTransactionModal;
