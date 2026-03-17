function EditTransactionModal({
    selectedTransaction,
    closeEditModal,
    onSave,
    editForm,
    setEditForm,
    showMccOptions,
    setShowMccOptions,
    mccOptions,
    saving,
}) {
    if (!selectedTransaction) return null;

    return (
        <div className="modal-backdrop" onClick={closeEditModal}>
            <section className="modal-card" onClick={(event) => event.stopPropagation()}>
                <div className="modal-header">
                    <h2>Edit transaction</h2>
                    <button className="icon-close" onClick={closeEditModal}>
                        ×
                    </button>
                </div>

                <form onSubmit={onSave} className="editor-form">
                    <label>
                        Merchant
                        <input
                            value={editForm.merchant}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, merchant: event.target.value }))}
                        />
                    </label>

                    <div className="row-2">
                        <label>
                            Amount
                            <input
                                type="number"
                                step="0.01"
                                value={editForm.amount}
                                onChange={(event) => setEditForm((prev) => ({ ...prev, amount: event.target.value }))}
                                required
                            />
                        </label>

                        <label>
                            Currency
                            <input
                                maxLength={3}
                                value={editForm.currency}
                                onChange={(event) =>
                                    setEditForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
                                }
                                required
                            />
                        </label>
                    </div>

                    <label>
                        Category
                        <input
                            value={editForm.category}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, category: event.target.value }))}
                        />
                    </label>

                    <label className="mcc-field">
                        MCC
                        <input
                            value={editForm.mcc_code}
                            onFocus={() => setShowMccOptions(true)}
                            onBlur={() => setTimeout(() => setShowMccOptions(false), 150)}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, mcc_code: event.target.value }))}
                            placeholder="Type code or description"
                        />
                        {showMccOptions && mccOptions.length > 0 && (
                            <ul className="mcc-options">
                                {mccOptions.map((option) => (
                                    <li
                                        key={option.mcc}
                                        onMouseDown={(event) => {
                                            event.preventDefault();
                                            setEditForm((prev) => ({ ...prev, mcc_code: option.mcc }));
                                            setShowMccOptions(false);
                                        }}
                                    >
                                        <strong>{option.mcc}</strong>
                                        <span>{option.description || "No description"}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </label>

                    <label>
                        Timestamp
                        <input
                            type="datetime-local"
                            value={editForm.transaction_timestamp}
                            onChange={(event) =>
                                setEditForm((prev) => ({ ...prev, transaction_timestamp: event.target.value }))
                            }
                            required
                        />
                    </label>

                    <div className="actions">
                        <button type="button" className="ghost" onClick={closeEditModal}>
                            Cancel
                        </button>
                        <button type="submit" disabled={saving}>
                            {saving ? "Saving..." : "Save changes"}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}

export default EditTransactionModal;
