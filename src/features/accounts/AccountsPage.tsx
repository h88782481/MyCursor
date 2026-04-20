/**
 * 账号管理页面
 *
 * 已迁移到 `features/accounts` 模块化结构。
 */

import React from "react";
import { LoadingSpinner, Toast, ConfirmDialog } from "@/components";
import { useAccountManagement } from "@/features/accounts/hooks/useAccountManagement";
import { useAccountsPageActions } from "@/features/accounts/hooks/useAccountsPageActions";
import { useAccountsPageEffects } from "@/features/accounts/hooks/useAccountsPageEffects";
import { useAccountsPageState } from "@/features/accounts/hooks/useAccountsPageState";
import { useAccountsPageList } from "@/features/accounts/hooks/useAccountsPageList";
import {
  AccountsToolbar,
  AccountsListSection,
  AccountUsageModal,
  SwitchAccountModal,
  AddAccountForm,
  EditAccountForm,
} from "./components";

const AccountsPage: React.FC = () => {
  const {
    accountData,
    loading,
    selectedAccounts,
    subscriptionFilter,
    refreshProgress,
    concurrentLimit,
    filteredAccounts,
    subscriptionFilterOptions,
    tagFilter,
    tagFilterOptions,
    loadAccounts,
    refreshCurrentAccount,
    addAccountToList,
    refreshSingleAccount,
    refreshAllAccounts,
    removeAccount,
    removeSelectedAccounts,
    refreshSelectedAccounts,
    toggleAccountSelection,
    toggleSelectAll,
    setSubscriptionFilter,
    setTagFilter,
    setConcurrentLimit,
  } = useAccountManagement();

  const {
    showAddForm,
    setShowAddForm,
    showEditForm,
    setShowEditForm,
    editingAccount,
    setEditingAccount,
    expandedAccountEmail,
    setExpandedAccountEmail,
    closingAccountEmail,
    setClosingAccountEmail,
    usageModalOpen,
    setUsageModalOpen,
    selectedAccountUsage,
    setSelectedAccountUsage,
    toast,
    setToast,
    confirmDialog,
    setConfirmDialog,
    switchModal,
    setSwitchModal,
  } = useAccountsPageState();

  useAccountsPageEffects({
    loadAccounts,
    addAccountToList,
    toast,
    setToast,
    setConfirmDialog,
  });

  const {
    handleAddSuccess,
    handleEditSuccess,
    handleRefreshAccount,
    handleSwitchAccount,
    handleSwitchConfirm,
    handleViewUsage,
    handleEditAccount,
    handleRemoveAccount,
    handleToggleExpand,
    handleCloseMenu,
    handleViewDashboard,
    handleViewBindCard,
    handleDeleteCursorAccount,
    handleLogout,
    handleExportSelectedAccounts,
    handleImportAccounts,
    handleRefreshCurrentAccount,
    handleRefreshAll,
    handleDeleteSelected,
  } = useAccountsPageActions({
    selectedAccounts,
    expandedAccountEmail,
    switchModal,
    setShowAddForm,
    setShowEditForm,
    setEditingAccount,
    setExpandedAccountEmail,
    setClosingAccountEmail,
    setUsageModalOpen,
    setSelectedAccountUsage,
    setToast,
    setConfirmDialog,
    setSwitchModal,
    loadAccounts,
    addAccountToList,
    refreshSingleAccount,
    removeAccount,
    refreshCurrentAccount,
    refreshSelectedAccounts,
    refreshAllAccounts,
    removeSelectedAccounts,
  });

  const {
    shouldUseVirtualScroll,
    isAllSelected,
    renderAccountCard,
  } = useAccountsPageList({
    accountData,
    filteredAccounts,
    selectedAccounts,
    expandedAccountEmail,
    closingAccountEmail,
    toggleAccountSelection,
    handleRefreshAccount,
    handleSwitchAccount,
    handleViewUsage,
    handleEditAccount,
    handleRemoveAccount,
    handleToggleExpand,
    handleCloseMenu,
    handleViewDashboard,
    handleViewBindCard,
    handleDeleteCursorAccount,
    handleLogout,
    setToast,
  });

  if (loading && !accountData) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{ overflow: "visible" }}>
      <div
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRadius: "var(--border-radius-lg)",
          boxShadow: "var(--shadow-medium)",
          overflow: "visible",
        }}
      >
        <AccountsToolbar
          showAddForm={showAddForm}
          selectedCount={selectedAccounts.size}
          refreshProgress={refreshProgress}
          subscriptionFilterOptions={subscriptionFilterOptions}
          subscriptionFilter={subscriptionFilter}
          onSubscriptionFilterChange={setSubscriptionFilter}
          tagFilterOptions={tagFilterOptions}
          tagFilter={tagFilter}
          onTagFilterChange={setTagFilter}
          concurrentLimit={concurrentLimit}
          onConcurrentLimitChange={setConcurrentLimit}
          onToggleAddForm={() => setShowAddForm((prev) => !prev)}
          onRefreshAll={handleRefreshAll}
          onDeleteSelected={handleDeleteSelected}
          onExportSelected={handleExportSelectedAccounts}
          onImportAccounts={handleImportAccounts}
          onRefreshCurrentAccount={handleRefreshCurrentAccount}
        />

        <AccountsListSection
          accountData={accountData}
          filteredAccounts={filteredAccounts}
          selectedAccounts={selectedAccounts}
          subscriptionFilter={subscriptionFilter}
          tagFilter={tagFilter}
          isAllSelected={isAllSelected}
          shouldUseVirtualScroll={shouldUseVirtualScroll}
          onToggleSelectAll={toggleSelectAll}
          renderAccountCard={renderAccountCard}
        />
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {confirmDialog.show && (
        <ConfirmDialog
          isOpen={confirmDialog.show}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog((prev) => ({ ...prev, show: false }))}
          checkboxLabel={confirmDialog.checkboxLabel}
          checkboxDefaultChecked={confirmDialog.checkboxDefaultChecked}
          type={confirmDialog.type}
          confirmText={confirmDialog.confirmText}
        />
      )}

      <SwitchAccountModal
        isOpen={switchModal.show}
        account={switchModal.account}
        resetMachineId={switchModal.resetMachineId}
        machineIdOption={switchModal.machineIdOption}
        onClose={() => setSwitchModal((prev) => ({ ...prev, show: false }))}
        onResetMachineIdChange={(value) => setSwitchModal((prev) => ({ ...prev, resetMachineId: value }))}
        onMachineIdOptionChange={(value) => setSwitchModal((prev) => ({ ...prev, machineIdOption: value }))}
        onConfirm={handleSwitchConfirm}
      />

      <AccountUsageModal
        isOpen={usageModalOpen}
        account={selectedAccountUsage?.account ?? null}
        onClose={() => setUsageModalOpen(false)}
      />

      <AddAccountForm
        isOpen={showAddForm}
        onSuccess={handleAddSuccess}
        onCancel={() => setShowAddForm(false)}
        onToast={(message, type) => setToast({ message, type })}
      />

      <EditAccountForm
        isOpen={showEditForm}
        account={editingAccount}
        onSuccess={handleEditSuccess}
        onCancel={() => {
          setShowEditForm(false);
          setEditingAccount(null);
        }}
        onToast={(message, type) => setToast({ message, type })}
      />
    </div>
  );
};

export default AccountsPage;
