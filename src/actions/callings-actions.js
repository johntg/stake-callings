export function createCallingsActions({
  appState,
  supabase,
  hasAdminPasswordAccess,
  getAssignmentFieldCandidates,
  renderCards,
  renderCurrentPage,
  archiveCallingRecord,
}) {
  function canUpdateAssignmentField(field) {
    const assignmentFields = new Set(getAssignmentFieldCandidates());

    if (!assignmentFields.has(field)) {
      return true;
    }

    return hasAdminPasswordAccess();
  }

  function isArchivedStatus(value) {
    return String(value).toLowerCase().trim() === "archived";
  }

  async function toggleDetails(id) {
    appState.expandedGridId = appState.expandedGridId === id ? null : id;
    renderCards();
  }

  async function toggleSustainingUnits(id) {
    if (appState.expandedSustainingIds.has(id)) {
      appState.expandedSustainingIds.delete(id);
    } else {
      appState.expandedSustainingIds.add(id);
    }
    renderCards();
  }

  async function updateSustainedUnits(id, unitName) {
    const item = appState.callings.find((calling) => calling.id === id);
    if (!item) return;

    let sustaining = Array.isArray(item.units_sustained)
      ? [...item.units_sustained]
      : [];

    if (sustaining.includes(unitName)) {
      sustaining = sustaining.filter((unit) => unit !== unitName);
    } else {
      sustaining.push(unitName);
    }

    item.units_sustained = sustaining;

    const { error } = await supabase
      .from("callings")
      .update({ units_sustained: sustaining })
      .eq("id", id);

    if (error) {
      console.error("Error updating sustaining units:", error);
      alert(`Failed to update sustaining units: ${error.message}`);
    } else {
      console.log("Sustaining units updated:", sustaining);
      renderCards();
    }
  }

  async function updateAssignment(id, field, value) {
    if (!canUpdateAssignmentField(field)) {
      alert("Assignments require signing in with the admin password.");
      return;
    }

    if (field === "status" && isArchivedStatus(value)) {
      await archiveCallingRecord(id, { confirm: true });
      return;
    }

    const { error } = await supabase
      .from("callings")
      .update({ [field]: value || null })
      .eq("id", id);

    if (error) {
      console.error("Assignment update error:", error);
      alert(`Failed to update assignment: ${error.message}`);
      return;
    }

    const item = appState.callings.find((calling) => calling.id === id);
    if (item) {
      item[field] = value || null;
    }

    renderCurrentPage();
  }

  function startInlineEdit(id, field) {
    if (!["name", "position"].includes(field)) {
      return;
    }

    if (!hasAdminPasswordAccess()) {
      alert("Editing records requires signing in with the admin password.");
      return;
    }

    const item = appState.callings.find((calling) => calling.id === id);
    if (!item) {
      alert("Could not find this record to edit.");
      return;
    }

    appState.activeInlineEdit = { id, field };
    renderCards();
  }

  function cancelInlineEdit() {
    if (!appState.activeInlineEdit) {
      return;
    }

    appState.activeInlineEdit = null;
    renderCards();
  }

  function handleInlineEditKeyup(event, id, field) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitInlineEdit(id, field, event.target.value);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelInlineEdit();
    }
  }

  async function commitInlineEdit(id, field, nextValue) {
    if (
      !appState.activeInlineEdit ||
      appState.activeInlineEdit.id !== id ||
      appState.activeInlineEdit.field !== field
    ) {
      return;
    }

    const item = appState.callings.find((calling) => calling.id === id);
    if (!item) {
      appState.activeInlineEdit = null;
      renderCards();
      return;
    }

    const currentValue = String(item[field] || "");
    const label = field === "name" ? "name" : "position";
    const cleaned = String(nextValue).trim();
    if (!cleaned) {
      appState.activeInlineEdit = null;
      renderCards();
      return;
    }

    if (cleaned === currentValue) {
      appState.activeInlineEdit = null;
      renderCards();
      return;
    }

    const { error } = await supabase
      .from("callings")
      .update({ [field]: cleaned })
      .eq("id", id);

    if (error) {
      console.error(`Failed to update ${field}:`, error);
      alert(`Failed to update ${label}: ${error.message}`);
      return;
    }

    item[field] = cleaned;
    appState.activeInlineEdit = null;
    renderCurrentPage();
  }

  async function archiveCalling(id) {
    await archiveCallingRecord(id, { confirm: true });
  }

  async function updateField(id, field, value) {
    const updateData = {};
    const isSettingApartDoneField = [
      "set_apart",
      "setting_apart_done",
      "sa_done",
      "set_apart_done",
    ].includes(field);

    if (field === "interviewed" || isSettingApartDoneField) {
      updateData[field] = value ? new Date().toISOString() : null;
    } else {
      updateData[field] = value;
    }

    if (value === true) {
      const timestamp = new Date().toISOString();
      if (field === "sp_approved") {
        updateData.sp_approved_date = timestamp;
      } else if (field === "hc_sustained") {
        updateData.hc_sustained_date = timestamp;
      }
    } else if (value === false) {
      if (field === "sp_approved") {
        updateData.sp_approved_date = null;
      } else if (field === "hc_sustained") {
        updateData.hc_sustained_date = null;
      }
    }

    console.log("Updating:", id, "with data:", updateData);

    const { error } = await supabase
      .from("callings")
      .update(updateData)
      .eq("id", id);

    if (error) {
      console.error("Update error:", error);
      alert(`Failed to update: ${error.message}`);
    } else {
      console.log("Update successful");
      const item = appState.callings.find((calling) => calling.id === id);
      Object.assign(item, updateData);
      renderCurrentPage();
    }
  }

  return {
    toggleDetails,
    toggleSustainingUnits,
    updateSustainedUnits,
    updateAssignment,
    startInlineEdit,
    cancelInlineEdit,
    handleInlineEditKeyup,
    commitInlineEdit,
    archiveCalling,
    updateField,
  };
}
