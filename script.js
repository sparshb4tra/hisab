// Expense Splitter Application
class ExpenseSplitter {
    constructor() {
        this.groups = this.loadFromStorage('expenseSplitterGroups') || {};
        this.currentGroupId = null;
        this.currentGroup = null;
        this.settlements = this.loadFromStorage('expenseSplitterSettlements') || {};
        
        this.init();
    }

    // Utility: sanitize any user-provided string before injecting into HTML
    static escapeHtml(unsafe) {
        const s = String(unsafe ?? '');
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Utility: money math in integer cents
    static toCents(amountNumber) {
        return Math.round((amountNumber || 0) * 100);
    }
    static fromCents(cents) {
        return (cents || 0) / 100;
    }

    init() {
        this.bindEvents();
        this.updateGroupsList();
        this.showWelcomeMessage();
        this.setDefaultParticipantDate();
        this.setupMobileHandlers();
    }

    setDefaultParticipantDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('participantJoinDate').value = today;
    }

    bindEvents() {
        // Group management
        document.getElementById('createGroup').addEventListener('click', () => this.createGroup());
        document.getElementById('addParticipant').addEventListener('click', () => this.addParticipant());
        document.getElementById('editGroupName').addEventListener('click', () => this.showEditGroupNameModal());
        document.getElementById('deleteGroup').addEventListener('click', () => this.deleteCurrentGroup());
        
        // Expense management
        document.getElementById('addExpense').addEventListener('click', () => this.addExpense());
        document.getElementById('splitMethod').addEventListener('change', (e) => this.handleSplitMethodChange(e));
        
        // Amount input validation - only allow numbers
        document.getElementById('expenseAmount').addEventListener('input', (e) => this.validateAmountInput(e));
        document.getElementById('settlementAmount').addEventListener('input', (e) => this.validateAmountInput(e));
        
        // Settlements
        document.getElementById('recordSettlement').addEventListener('click', () => this.recordSettlement());
        
        // Export dropdown
        document.getElementById('exportSummaryBtn').addEventListener('click', (e) => this.toggleExportDropdown(e));
        
        // Export options
        document.querySelectorAll('.export-option').forEach(option => {
            option.addEventListener('click', (e) => this.handleExportOption(e));
        });
        
        // User perspective selector
        document.getElementById('summaryUserSelect').addEventListener('change', (e) => this.updateSummaryFromPerspective(e.target.value));
        
        // Share
        document.getElementById('shareSummary').addEventListener('click', () => this.shareSummary());
        
        // Modal events
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => this.closeModal(e.target.closest('.modal')));
        });
        
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target);
            }
        });

        // Edit group name modal
        document.getElementById('saveGroupName').addEventListener('click', () => this.saveGroupName());
    }

    setupMobileHandlers() {
        const sidebar = document.getElementById('sidebar');
        const hamburger = document.getElementById('hamburgerBtn');
        const closeBtn = document.getElementById('closeSidebarBtn');
        const backdrop = document.getElementById('sidebarBackdrop');
        const mobileCta = document.getElementById('mobileCta');
        const mobileCreate = document.getElementById('mobileCreateGroup');
        const dateInput = document.getElementById('participantJoinDate');
        const openDateBtn = document.getElementById('openDatePicker');
        if (hamburger && sidebar) {
            hamburger.addEventListener('click', () => {
                const isOpen = sidebar.classList.toggle('is-open');
                if (hamburger) hamburger.setAttribute('aria-expanded', String(isOpen));
                if (backdrop) backdrop.style.display = isOpen ? 'block' : 'none';
                // While menu is open, unstick topbar; restore when closed if a group is active
                if (isOpen) {
                    document.body.classList.remove('topbar-fixed');
                } else if (this.currentGroupId) {
                    document.body.classList.add('topbar-fixed');
                }
            });
        }
        if (closeBtn && sidebar) {
            const close = () => {
                sidebar.classList.remove('is-open');
                if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
                if (backdrop) backdrop.style.display = 'none';
                if (this.currentGroupId) {
                    document.body.classList.add('topbar-fixed');
                }
            };
            closeBtn.addEventListener('click', close);
            if (backdrop) backdrop.addEventListener('click', close);
        }

        // Auto-open sidebar on mobile if no group selected
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile && (!this.currentGroupId || Object.keys(this.groups).length === 0)) {
            if (sidebar) sidebar.classList.add('is-open');
            if (backdrop) backdrop.style.display = 'block';
            if (mobileCta) mobileCta.style.display = 'block';
            // In the intro/menu state, do not fix the topbar
            document.body.classList.remove('topbar-fixed');
        } else if (isMobile) {
            if (mobileCta) mobileCta.style.display = 'none';
        }

        if (mobileCreate) {
            mobileCreate.addEventListener('click', () => {
                // Ensure sidebar is open to create group
                if (isMobile && sidebar) sidebar.classList.add('is-open');
                if (backdrop) backdrop.style.display = 'block';
                // Focus group name input
                const input = document.getElementById('groupName');
                if (input) input.focus();
            });
        }

        // Calendar button triggers native date picker
        if (openDateBtn && dateInput) {
            openDateBtn.addEventListener('click', () => {
                dateInput.showPicker ? dateInput.showPicker() : dateInput.focus();
            });
        }
    }

    // Input Validation
    validateAmountInput(event) {
        const input = event.target;
        const value = input.value;
        
        // Remove any non-numeric characters except decimal point
        const cleanValue = value.replace(/[^\d.]/g, '');
        
        // Ensure only one decimal point
        const parts = cleanValue.split('.');
        if (parts.length > 2) {
            input.value = parts[0] + '.' + parts.slice(1).join('');
        } else {
            input.value = cleanValue;
        }
        
        // Limit to 2 decimal places
        if (parts.length === 2 && parts[1].length > 2) {
            input.value = parts[0] + '.' + parts[1].substring(0, 2);
        }
    }

    // Group Management
    createGroup() {
        const groupName = document.getElementById('groupName').value.trim();
        if (!groupName) {
            this.showNotification('Please enter a group name', 'error');
            return;
        }

        // Get the selected currency from the expense form
        const selectedCurrency = document.getElementById('expenseCurrency').value;
        
        const groupId = Date.now().toString();
        const newGroup = {
            id: groupId,
            name: groupName,
            participants: [],
            expenses: [],
            createdAt: new Date().toISOString(),
            currency: selectedCurrency // Use the selected currency
        };

        this.groups[groupId] = newGroup;
        this.saveToStorage('expenseSplitterGroups', this.groups);
        
        this.setCurrentGroup(groupId);
        this.updateGroupsList();
        
        // Disable group name input and show success message
        document.getElementById('groupName').disabled = true;
        document.getElementById('groupName').value = '';
        this.showNotification(`Group "${groupName}" created successfully!`, 'success');
    }

    setCurrentGroup(groupId) {
        this.currentGroupId = groupId;
        this.currentGroup = this.groups[groupId];
        
        // Update main title and subtitle
        document.getElementById('mainTitle').textContent = this.currentGroup.name;
        document.getElementById('mainSubtitle').textContent = `Managing expenses for ${this.currentGroup.name}`;
        
        // Update group display name
        document.getElementById('groupNameDisplay').textContent = this.currentGroup.name;
        
        // Show all sections
        document.getElementById('groupSection').style.display = 'block';
        document.getElementById('expenseSection').style.display = 'block';
        document.getElementById('expensesListSection').style.display = 'block';
        document.getElementById('balancesSection').style.display = 'block';
        document.getElementById('summarySection').style.display = 'block';
        
        // Update active state in sidebar
        this.updateActiveGroupInSidebar();
        
        // Migrate old participants to new format if needed
        this.migrateParticipants();
        
        this.updateParticipantsList();
        this.updateExpensePayerDropdown();
        this.updateExpenseCurrencyDropdown();
        this.updateUserSelectorDropdown();
        this.updateExpensesList();
        this.updateBalances();
        this.updateSummary();
        this.updateSettlementDropdowns();

        // Close sidebar on mobile after selection
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile) {
            // enable sticky topbar only when a group is active
            document.body.classList.add('topbar-fixed');
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('is-open');
            const hamburger = document.getElementById('hamburgerBtn');
            if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
            const backdrop = document.getElementById('sidebarBackdrop');
            if (backdrop) backdrop.style.display = 'none';
            const mobileCta = document.getElementById('mobileCta');
            if (mobileCta) mobileCta.style.display = 'none';
        }
    }

    updateActiveGroupInSidebar() {
        // Remove active class from all group cards
        document.querySelectorAll('.group-card').forEach(card => {
            card.classList.remove('active');
        });
        
        // Add active class to current group card
        const currentGroupCard = document.querySelector(`[data-group-id="${this.currentGroupId}"]`);
        if (currentGroupCard) {
            currentGroupCard.classList.add('active');
        }
    }

    addParticipant() {
        const participantName = document.getElementById('participantName').value.trim();
        const joinDate = document.getElementById('participantJoinDate').value;
        
        if (!participantName) {
            this.showNotification('Please enter a participant name', 'error');
            return;
        }

        if (this.currentGroup.participants.some(p => (p.name || p) === participantName)) {
            this.showNotification('Participant already exists', 'error');
            return;
        }

        const participant = {
            name: participantName,
            joinDate: joinDate || new Date().toISOString().split('T')[0]
        };

        this.currentGroup.participants.push(participant);
        this.saveToStorage('expenseSplitterGroups', this.groups);
        
        this.updateParticipantsList();
        this.updateExpensePayerDropdown();
        this.updateSettlementDropdowns();
        this.updateGroupsList(); // Update sidebar stats
        
        document.getElementById('participantName').value = '';
        document.getElementById('participantJoinDate').value = '';
        this.showNotification(`Participant "${participantName}" added successfully!`, 'success');
    }

    // Migrate old participants to new format
    migrateParticipants() {
        if (!this.currentGroup || !this.currentGroup.participants) return;
        
        let needsMigration = false;
        this.currentGroup.participants = this.currentGroup.participants.map(participant => {
            if (typeof participant === 'string') {
                needsMigration = true;
                return {
                    name: participant,
                    joinDate: new Date().toISOString().split('T')[0]
                };
            }
            return participant;
        });
        
        if (needsMigration) {
            this.saveToStorage('expenseSplitterGroups', this.groups);
            this.updateParticipantsList();
            this.updateExpensePayerDropdown();
            this.updateSettlementDropdowns();
        }
    }

    removeParticipant(participantName) {
        if (this.currentGroup.participants.length <= 1) {
            this.showNotification('Cannot remove the last participant', 'error');
            return;
        }
        // Block removal if participant is referenced by expenses or settlements
        const isPayerInAny = this.currentGroup.expenses.some(e => e.payer === participantName);
        const isInSplits = this.currentGroup.expenses.some(e => Object.keys(e.splitDetails || {}).includes(participantName));
        const groupSettlements = this.settlements[this.currentGroupId] || [];
        const isInSettlements = groupSettlements.some(s => s.from === participantName || s.to === participantName);
        if (isPayerInAny || isInSplits || isInSettlements) {
            this.showNotification('Cannot remove participant referenced in expenses or settlements. Edit or delete those records first.', 'error');
            return;
        }

        this.currentGroup.participants = this.currentGroup.participants.filter(p => (p.name || p) !== participantName);

        this.saveToStorage('expenseSplitterGroups', this.groups);
        
        // If removed participant was selected as payer in the form, clear it
        const payerSelect = document.getElementById('expensePayer');
        if (payerSelect && payerSelect.value === participantName) {
            payerSelect.value = '';
        }

        this.updateParticipantsList();
        this.updateExpensePayerDropdown();
        this.updateSettlementDropdowns();
        this.updateExpensesList();
        this.updateBalances();
        this.updateSummary();
        this.updateGroupsList(); // Update sidebar stats
        
        this.showNotification(`Participant "${participantName}" removed successfully!`, 'success');
    }

    updateParticipantsList() {
        const participantsList = document.getElementById('participantsList');
        participantsList.innerHTML = '';

        this.currentGroup.participants.forEach(participant => {
            const participantCard = document.createElement('div');
            participantCard.className = 'participant-card';
            const participantName = participant.name || participant;
            const joinDate = participant.joinDate || 'N/A';
            const formattedDate = joinDate !== 'N/A' ? new Date(joinDate).toLocaleDateString() : 'N/A';
            participantCard.innerHTML = `
                <div class="participant-info">
                    <span class="participant-name">${ExpenseSplitter.escapeHtml(participantName)}</span>
                    <span class="participant-date">Joined: ${ExpenseSplitter.escapeHtml(formattedDate)}</span>
                </div>
                <button class="remove-participant" onclick="expenseSplitter.removeParticipant('${ExpenseSplitter.escapeHtml(participantName)}')">
                    <img src="public/close-icon.png" alt="Remove" class="icon">
                </button>
            `;
            participantsList.appendChild(participantCard);
        });
    }

    // Group Name Editing
    showEditGroupNameModal() {
        const modal = document.getElementById('editGroupNameModal');
        const input = document.getElementById('editGroupNameInput');
        input.value = this.currentGroup.name;
        modal.style.display = 'block';
    }

    saveGroupName() {
        const newName = document.getElementById('editGroupNameInput').value.trim();
        if (!newName) {
            this.showNotification('Please enter a group name', 'error');
            return;
        }

        this.currentGroup.name = newName;
        this.saveToStorage('expenseSplitterGroups', this.groups);
        
        // Update all displays
        document.getElementById('mainTitle').textContent = newName;
        document.getElementById('mainSubtitle').textContent = `Managing expenses for ${newName}`;
        document.getElementById('groupNameDisplay').textContent = newName;
        
        this.updateGroupsList();
        this.closeModal(document.getElementById('editGroupNameModal'));
        this.showNotification('Group name updated successfully!', 'success');
    }

    deleteCurrentGroup() {
        if (confirm(`Are you sure you want to delete the group "${this.currentGroup.name}"? This action cannot be undone.`)) {
            delete this.groups[this.currentGroupId];
            this.saveToStorage('expenseSplitterGroups', this.groups);
            
            // Clear current group
            this.currentGroupId = null;
            this.currentGroup = null;
            
            // Reset UI
            this.resetUI();
            this.updateGroupsList();
            
            this.showNotification('Group deleted successfully!', 'success');
        }
    }

    deleteGroup(groupId) {
        const group = this.groups[groupId];
        if (!group) return;
        
        if (confirm(`Are you sure you want to delete the group "${group.name}"? This action cannot be undone.`)) {
            delete this.groups[groupId];
            this.saveToStorage('expenseSplitterGroups', this.groups);
            
            // If we're deleting the current group, reset the UI
            if (groupId === this.currentGroupId) {
                this.currentGroupId = null;
                this.currentGroup = null;
                this.resetUI();
            }
            
            this.updateGroupsList();
            this.showNotification('Group deleted successfully!', 'success');
        }
    }

    resetUI() {
        // Reset main title
        document.getElementById('mainTitle').textContent = 'Welcome to hisab';
        document.getElementById('mainSubtitle').textContent = 'Create a group to get started';
        
        // Hide all sections
        document.getElementById('groupSection').style.display = 'none';
        document.getElementById('expenseSection').style.display = 'none';
        document.getElementById('expensesListSection').style.display = 'none';
        document.getElementById('balancesSection').style.display = 'none';
        document.getElementById('summarySection').style.display = 'none';
        
        // Re-enable group name input
        document.getElementById('groupName').disabled = false;
        
        // Reset currency dropdown
        const currencySelect = document.getElementById('expenseCurrency');
        currencySelect.disabled = false;
        currencySelect.style.backgroundColor = '#ffffff';
        currencySelect.style.cursor = 'pointer';
        currencySelect.value = 'USD'; // Reset to default
        
        // Clear active state in sidebar
        document.querySelectorAll('.group-card').forEach(card => {
            card.classList.remove('active');
        });
        
        // Remove sticky topbar when no group is selected
        document.body.classList.remove('topbar-fixed');
    }

    // Expense Management
    addExpense() {
        const description = document.getElementById('expenseDescription').value.trim();
        const amountInput = document.getElementById('expenseAmount').value;
        const category = document.getElementById('expenseCategory').value;
        const payer = document.getElementById('expensePayer').value;
        const currency = document.getElementById('expenseCurrency').value;
        const splitMethod = document.getElementById('splitMethod').value;

        // Validate amount - only allow numbers
        if (!/^\d+(\.\d{1,2})?$/.test(amountInput)) {
            this.showNotification('Amount must be a valid number (e.g., 25.50)', 'error');
            return;
        }

        const amount = parseFloat(amountInput);

        if (!description || !amount || !payer) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        if (amount <= 0) {
            this.showNotification('Amount must be greater than 0', 'error');
            return;
        }

        // Ensure currency consistency - use group's default currency
        const groupCurrency = this.currentGroup.currency || 'USD';

        let splitDetails = {};
        
        switch (splitMethod) {
            case 'equal':
                splitDetails = this.calculateEqualSplit(amount);
                break;
            case 'custom':
                splitDetails = this.getCustomSplitInputs();
                break;
            case 'percentage':
                splitDetails = this.getPercentageSplitInputs();
                break;
        }

        if (!splitDetails || Object.keys(splitDetails).length === 0) {
            this.showNotification('Please configure split details', 'error');
            return;
        }

        const expense = {
            id: Date.now().toString(),
            description,
            amount,
            category,
            payer,
            currency: groupCurrency, // Use group's default currency
            splitMethod,
            splitDetails,
            date: new Date().toISOString()
        };

        console.log('Adding expense:', expense);
        console.log('Current group:', this.currentGroup);

        this.currentGroup.expenses.push(expense);
        this.saveToStorage('expenseSplitterGroups', this.groups);
        
        this.updateExpensesList();
        this.updateBalances();
        this.updateSummary();
        this.updateGroupsList(); // Update sidebar stats
        
        // Reset form
        document.getElementById('expenseDescription').value = '';
        document.getElementById('expenseAmount').value = '';
        document.getElementById('expenseCategory').value = 'food';
        document.getElementById('expensePayer').value = '';
        document.getElementById('splitMethod').value = 'equal';
        this.handleSplitMethodChange({ target: { value: 'equal' } });
        
        // Clear split inputs
        this.clearSplitInputs();
        
        this.showNotification('Expense added successfully!', 'success');
    }

    clearSplitInputs() {
        // Clear custom split inputs
        const customInputs = document.querySelectorAll('#customSplitInputs input[type="number"]');
        customInputs.forEach(input => {
            input.value = '';
        });
        
        // Clear percentage split inputs
        const percentageInputs = document.querySelectorAll('#percentageSplitInputs input[type="number"]');
        percentageInputs.forEach(input => {
            input.value = '';
        });
    }

    calculateEqualSplit(amount) {
        const participantCount = this.currentGroup.participants.length;
        const cents = ExpenseSplitter.toCents(amount);
        const base = Math.floor(cents / participantCount);
        let remainder = cents - base * participantCount;
        const splitDetails = {};
        this.currentGroup.participants.forEach((participant, idx) => {
            const participantName = participant.name || participant;
            let share = base;
            if (remainder > 0) {
                share += 1; // distribute leftover pennies to first N participants
                remainder -= 1;
            }
            splitDetails[participantName] = ExpenseSplitter.fromCents(share);
        });
        return splitDetails;
    }

    getCustomSplitInputs() {
        const customInputs = document.querySelectorAll('#customSplitInputs input[type="number"]');
        const splitDetails = {};
        let totalCents = 0;
        customInputs.forEach(input => {
            const participant = input.dataset.participant;
            const amount = parseFloat(input.value) || 0;
            const cents = ExpenseSplitter.toCents(amount);
            if (cents > 0) {
                splitDetails[participant] = ExpenseSplitter.fromCents(cents);
                totalCents += cents;
            }
        });
        const expenseAmount = parseFloat(document.getElementById('expenseAmount').value) || 0;
        const expenseCents = ExpenseSplitter.toCents(expenseAmount);
        if (totalCents !== expenseCents) {
            this.showNotification(`Custom split amounts (${ExpenseSplitter.fromCents(totalCents).toFixed(2)}) must equal the total expense amount (${ExpenseSplitter.fromCents(expenseCents).toFixed(2)})`, 'error');
            return null;
        }
        if (Object.keys(splitDetails).length === 0) {
            this.showNotification('Please enter at least one custom split amount', 'error');
            return null;
        }
        return splitDetails;
    }

    getPercentageSplitInputs() {
        const percentageInputs = document.querySelectorAll('#percentageSplitInputs input[type="number"]');
        const splitDetails = {};
        let totalPercent = 0;
        percentageInputs.forEach(input => {
            const participant = input.dataset.participant;
            const percentage = parseFloat(input.value) || 0;
            if (percentage > 0) {
                splitDetails[participant] = percentage;
                totalPercent += percentage;
            }
        });
        if (Math.abs(totalPercent - 100) > 0.0001 || totalPercent === 0) {
            this.showNotification('Percentages must add up to 100% with at least one non-zero participant', 'error');
            return null;
        }
        const expenseAmount = parseFloat(document.getElementById('expenseAmount').value) || 0;
        const expenseCents = ExpenseSplitter.toCents(expenseAmount);
        // Allocate cents with remainder distribution
        const participants = Object.keys(splitDetails);
        let allocated = 0;
        const centsShares = {};
        participants.forEach((p, idx) => {
            const share = Math.floor((splitDetails[p] / 100) * expenseCents);
            centsShares[p] = share;
            allocated += share;
        });
        let remainder = expenseCents - allocated;
        let i = 0;
        while (remainder > 0 && participants.length > 0) {
            const p = participants[i % participants.length];
            centsShares[p] += 1;
            remainder -= 1;
            i++;
        }
        const result = {};
        Object.keys(centsShares).forEach(p => {
            result[p] = ExpenseSplitter.fromCents(centsShares[p]);
        });
        return result;
    }

    handleSplitMethodChange(event) {
        const splitOptions = document.getElementById('splitOptions');
        const equalSplit = document.getElementById('equalSplit');
        const customSplit = document.getElementById('customSplit');
        const percentageSplit = document.getElementById('percentageSplit');
        
        splitOptions.style.display = 'block';
        equalSplit.style.display = 'none';
        customSplit.style.display = 'none';
        percentageSplit.style.display = 'none';
        
        switch (event.target.value) {
            case 'equal':
                equalSplit.style.display = 'block';
                break;
            case 'custom':
                customSplit.style.display = 'block';
                this.setupCustomSplitInputs();
                break;
            case 'percentage':
                percentageSplit.style.display = 'block';
                this.setupPercentageSplitInputs();
                break;
        }
    }

    setupCustomSplitInputs() {
        const container = document.getElementById('customSplitInputs');
        container.innerHTML = '';
        
        this.currentGroup.participants.forEach(participant => {
            const participantName = participant.name || participant;
            const splitInput = document.createElement('div');
            splitInput.className = 'split-input';
            splitInput.innerHTML = `
                <span>${participantName}</span>
                <input type="number" data-participant="${participantName}" placeholder="Amount" step="0.01" min="0">
                <span class="currency">${this.currentGroup.currency}</span>
            `;
            container.appendChild(splitInput);
        });
    }

    setupPercentageSplitInputs() {
        const container = document.getElementById('percentageSplitInputs');
        container.innerHTML = '';
        
        this.currentGroup.participants.forEach(participant => {
            const participantName = participant.name || participant;
            const splitInput = document.createElement('div');
            splitInput.className = 'split-input';
            splitInput.innerHTML = `
                <span>${participantName}</span>
                <input type="number" data-participant="${participantName}" placeholder="%" step="0.1" min="0" max="100">
                <span>%</span>
            `;
            container.appendChild(splitInput);
        });
    }

    updateExpensePayerDropdown() {
        const payerSelect = document.getElementById('expensePayer');
        payerSelect.innerHTML = '<option value="">Who paid?</option>';
        
        console.log('Updating payer dropdown with participants:', this.currentGroup.participants);
        
        this.currentGroup.participants.forEach(participant => {
            const participantName = participant.name || participant;
            console.log('Adding participant to dropdown:', participantName);
            const option = document.createElement('option');
            option.value = participantName;
            option.textContent = participantName;
            payerSelect.appendChild(option);
        });
    }

    updateExpenseCurrencyDropdown() {
        const currencySelect = document.getElementById('expenseCurrency');
        const groupCurrency = this.currentGroup.currency || 'USD';
        
        // Set the currency dropdown to the group's currency
        currencySelect.value = groupCurrency;
        
        // Disable the currency dropdown to prevent changes
        currencySelect.disabled = true;
        
        // Add visual styling for disabled state
        currencySelect.style.backgroundColor = '#f8f9fa';
        currencySelect.style.cursor = 'not-allowed';
        
        console.log('Currency dropdown locked to:', groupCurrency);
    }

    updateUserSelectorDropdown() {
        const userSelect = document.getElementById('summaryUserSelect');
        userSelect.innerHTML = '<option value="">Select a participant</option>';
        
        if (this.currentGroup && this.currentGroup.participants) {
            this.currentGroup.participants.forEach(participant => {
                const participantName = participant.name || participant;
                const option = document.createElement('option');
                option.value = participantName;
                option.textContent = participantName;
                userSelect.appendChild(option);
            });
        }
        
        console.log('User selector dropdown populated with participants');
    }

    updateExpensesList() {
        const expensesList = document.getElementById('expensesList');
        expensesList.innerHTML = '';

        if (this.currentGroup.expenses.length === 0) {
            expensesList.innerHTML = '<p style="text-align: center; color: #718096;">No expenses added yet.</p>';
            return;
        }

        this.currentGroup.expenses.forEach(expense => {
            const expenseItem = document.createElement('div');
            expenseItem.className = 'expense-item';
            expenseItem.innerHTML = `
                <div class="expense-info">
                    <div class="expense-description">${ExpenseSplitter.escapeHtml(expense.description)}</div>
                    <div class="expense-category">${this.getCategoryEmoji(expense.category)} ${ExpenseSplitter.escapeHtml(expense.category)}</div>
                    <div>Paid by: ${ExpenseSplitter.escapeHtml(expense.payer)}</div>
                </div>
                <div class="expense-amount">${this.formatCurrency(expense.amount, expense.currency)}</div>
                <div class="expense-date">${new Date(expense.date).toLocaleDateString()}</div>
                <div class="expense-actions">
                    <button class="btn btn-secondary" onclick="expenseSplitter.editExpense('${expense.id}')">
                        <img src="public/edit-icon.png" alt="Edit" class="icon">
                    </button>
                    <button class="btn btn-danger" onclick="expenseSplitter.deleteExpense('${expense.id}')">
                        <img src="public/trash-icon.png" alt="Delete" class="icon">
                    </button>
                </div>
            `;
            expensesList.appendChild(expenseItem);
        });
    }

    getCategoryEmoji(category) {
        const emojis = {
            food: '🍕',
            transportation: '🚗',
            accommodation: '🏨',
            entertainment: '🎮',
            utilities: '⚡',
            other: '📦'
        };
        return emojis[category] || '📦';
    }

    formatCurrency(amount, currency) {
        const symbols = {
            USD: '$',
            EUR: '€',
            GBP: '£',
            CAD: 'C$',
            INR: '₹'
        };
        return `${symbols[currency] || '$'}${amount.toFixed(2)}`;
    }

    editExpense(expenseId) {
        const expense = this.currentGroup.expenses.find(e => e.id === expenseId);
        if (!expense) return;

        document.getElementById('editExpenseDescription').value = expense.description;
        document.getElementById('editExpenseCategory').value = expense.category;
        document.getElementById('editExpenseAmount').value = expense.amount;
        document.getElementById('editExpensePayer').value = expense.payer;
        
        // Update payer dropdown in edit modal
        const editPayerSelect = document.getElementById('editExpensePayer');
        editPayerSelect.innerHTML = '<option value="">Who paid?</option>';
        this.currentGroup.participants.forEach(participant => {
            const participantName = participant.name || participant;
            const option = document.createElement('option');
            option.value = participantName;
            option.textContent = participantName;
            if (participantName === expense.payer) option.selected = true;
            editPayerSelect.appendChild(option);
        });

        document.getElementById('editExpenseModal').style.display = 'block';
        
        // Store expense ID for saving
        document.getElementById('saveExpenseEdit').onclick = () => this.saveExpenseEdit(expenseId);
    }

    saveExpenseEdit(expenseId) {
        const expense = this.currentGroup.expenses.find(e => e.id === expenseId);
        if (!expense) return;

        expense.description = document.getElementById('editExpenseDescription').value.trim();
        expense.category = document.getElementById('editExpenseCategory').value;
        expense.amount = parseFloat(document.getElementById('editExpenseAmount').value);
        expense.payer = document.getElementById('editExpensePayer').value;

        if (!expense.description || !expense.amount || !expense.payer) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        this.saveToStorage('expenseSplitterGroups', this.groups);
        this.updateExpensesList();
        this.updateBalances();
        this.updateSummary();
        this.updateGroupsList(); // Update sidebar stats
        
        this.closeModal(document.getElementById('editExpenseModal'));
        this.showNotification('Expense updated successfully!', 'success');
    }

    deleteExpense(expenseId) {
        if (confirm('Are you sure you want to delete this expense?')) {
            this.currentGroup.expenses = this.currentGroup.expenses.filter(e => e.id !== expenseId);
            this.saveToStorage('expenseSplitterGroups', this.groups);
            
            this.updateExpensesList();
            this.updateBalances();
            this.updateSummary();
            this.updateGroupsList(); // Update sidebar stats
            
            this.showNotification('Expense deleted successfully!', 'success');
        }
    }

    closeModal(modal) {
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Balance Calculations
    updateBalances() {
        const balancesSummary = document.getElementById('balancesSummary');
        balancesSummary.innerHTML = '';

        if (this.currentGroup.participants.length === 0 || this.currentGroup.expenses.length === 0) {
            balancesSummary.innerHTML = '<p style="text-align: center; color: #718096;">No expenses to calculate balances.</p>';
            return;
        }

        const balances = this.calculateBalances();
        
        Object.entries(balances).forEach(([participant, balance]) => {
            const balanceItem = document.createElement('div');
            balanceItem.className = `balance-item ${balance >= 0 ? 'balance-positive' : 'balance-negative'}`;
            balanceItem.innerHTML = `
                <span>${participant}</span>
                <span class="balance-amount">${this.formatCurrency(Math.abs(balance), this.currentGroup.currency)} ${balance >= 0 ? 'owed' : 'owes'}</span>
            `;
            balancesSummary.appendChild(balanceItem);
        });
    }

    calculateBalances() {
        const balances = {};
        this.currentGroup.participants.forEach(participant => {
            const participantName = participant.name || participant;
            balances[participantName] = 0;
        });

        // Calculate what each person paid vs what they owe
        this.currentGroup.expenses.forEach(expense => {
            // Add what the payer paid
            balances[expense.payer] += expense.amount;
            
            // Subtract what each person owes
            Object.entries(expense.splitDetails).forEach(([participant, amount]) => {
                balances[participant] -= amount;
            });
        });

        // Apply settlements
        const groupSettlements = this.settlements[this.currentGroupId] || [];
        groupSettlements.forEach(settlement => {
            balances[settlement.from] -= settlement.amount;
            balances[settlement.to] += settlement.amount;
        });

        return balances;
    }

    // Settlements
    updateSettlementDropdowns() {
        const fromSelect = document.getElementById('settlementFrom');
        const toSelect = document.getElementById('settlementTo');
        
        fromSelect.innerHTML = '<option value="">Who is paying?</option>';
        toSelect.innerHTML = '<option value="">Who is receiving?</option>';
        
        this.currentGroup.participants.forEach(participant => {
            const participantName = participant.name || participant;
            const fromOption = document.createElement('option');
            fromOption.value = participantName;
            fromOption.textContent = participantName;
            fromSelect.appendChild(fromOption);
            
            const toOption = document.createElement('option');
            toOption.value = participantName;
            toOption.textContent = participantName;
            toSelect.appendChild(toOption);
        });
    }

    recordSettlement() {
        const from = document.getElementById('settlementFrom').value;
        const to = document.getElementById('settlementTo').value;
        const amount = parseFloat(document.getElementById('settlementAmount').value);

        if (!from || !to || !amount) {
            this.showNotification('Please fill in all settlement fields', 'error');
            return;
        }

        if (from === to) {
            this.showNotification('Cannot settle with yourself', 'error');
            return;
        }

        if (amount <= 0) {
            this.showNotification('Settlement amount must be greater than 0', 'error');
            return;
        }

        if (!this.settlements[this.currentGroupId]) {
            this.settlements[this.currentGroupId] = [];
        }

        const settlement = {
            id: Date.now().toString(),
            from,
            to,
            amount,
            date: new Date().toISOString()
        };

        this.settlements[this.currentGroupId].push(settlement);
        this.saveToStorage('expenseSplitterSettlements', this.settlements);
        
        this.updateBalances();
        this.updateSummary();
        
        // Reset form
        document.getElementById('settlementFrom').value = '';
        document.getElementById('settlementTo').value = '';
        document.getElementById('settlementAmount').value = '';
        
        this.showNotification('Settlement recorded successfully!', 'success');
    }

    // Summary
    updateSummary() {
        const summaryStats = document.getElementById('summaryStats');
        summaryStats.innerHTML = '';

        if (this.currentGroup.expenses.length === 0) {
            summaryStats.innerHTML = '<p style="text-align: center; color: #718096;">No expenses to summarize.</p>';
            return;
        }

        const totalExpenses = this.currentGroup.expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const totalParticipants = this.currentGroup.participants.length;
        const averagePerPerson = totalExpenses / totalParticipants;
        const totalSettlements = (this.settlements[this.currentGroupId] || []).reduce((sum, settlement) => sum + settlement.amount, 0);

        const stats = [
            { value: this.formatCurrency(totalExpenses, this.currentGroup.currency), label: 'Total Expenses' },
            { value: totalParticipants, label: 'Participants' },
            { value: this.formatCurrency(averagePerPerson, this.currentGroup.currency), label: 'Average per Person' },
            { value: this.currentGroup.expenses.length, label: 'Number of Expenses' },
            { value: this.formatCurrency(totalSettlements, this.currentGroup.currency), label: 'Total Settlements' }
        ];

        stats.forEach(stat => {
            const statCard = document.createElement('div');
            statCard.className = 'stat-card';
            statCard.innerHTML = `
                <div class="stat-value">${stat.value}</div>
                <div class="stat-label">${stat.label}</div>
            `;
            summaryStats.appendChild(statCard);
        });

        // Add detailed participant balance cards
        this.updateDetailedBalanceCards();
    }

    // Called when perspective dropdown changes
    updateSummaryFromPerspective(selectedUser) {
        // No extra state to keep; just re-render the detailed cards
        // This will read the current select value and rebuild cards
        this.updateDetailedBalanceCards();
    }

    updateDetailedBalanceCards() {
        const summaryStats = document.getElementById('summaryStats');
        
        // Remove existing balance cards if they exist
        const existingBalanceCards = summaryStats.querySelectorAll('.participant-balance-card');
        existingBalanceCards.forEach(card => card.remove());
        
        // Add a separator
        const separator = document.createElement('div');
        separator.style.cssText = 'grid-column: 1 / -1; height: 1px; background: #e9ecef; margin: 20px 0;';
        summaryStats.appendChild(separator);

        // Get selected user perspective
        const selectedUser = document.getElementById('summaryUserSelect').value;
        
        if (!selectedUser) {
            // If no user selected, show neutral balances
            const balances = this.calculateBalances();
            Object.entries(balances).forEach(([participant, balance]) => {
                this.createBalanceCard(summaryStats, participant, balance, null);
            });
        } else {
            // Show balances from selected user's perspective
            const balances = this.calculateBalancesFromPerspective(selectedUser);
            Object.entries(balances).forEach(([participant, balance]) => {
                if (participant !== selectedUser) { // Don't show the selected user's own card
                    this.createBalanceCard(summaryStats, participant, balance, selectedUser);
                }
            });
        }
    }

    createBalanceCard(container, participant, balance, perspectiveUser) {
        const balanceCard = document.createElement('div');
        balanceCard.className = 'stat-card participant-balance-card';
        
        let balanceText, balanceClass, icon;
        
        if (perspectiveUser) {
            // From specific user's perspective
            if (balance > 0) {
                balanceText = `${participant} owes ${perspectiveUser} ${this.formatCurrency(balance, this.currentGroup.currency)}`;
                balanceClass = 'balance-positive';
                icon = '💰';
            } else if (balance < 0) {
                balanceText = `${perspectiveUser} owes ${participant} ${this.formatCurrency(Math.abs(balance), this.currentGroup.currency)}`;
                balanceClass = 'balance-negative';
                icon = '💸';
            } else {
                balanceText = 'All settled up!';
                balanceClass = 'balance-neutral';
                icon = '✅';
            }
        } else {
            // Neutral perspective (no user selected)
            if (balance > 0) {
                balanceText = `${participant} is owed ${this.formatCurrency(balance, this.currentGroup.currency)}`;
                balanceClass = 'balance-positive';
                icon = '💰';
            } else if (balance < 0) {
                balanceText = `${participant} owes ${this.formatCurrency(Math.abs(balance), this.currentGroup.currency)}`;
                balanceClass = 'balance-negative';
                icon = '💸';
            } else {
                balanceText = 'All settled up!';
                balanceClass = 'balance-neutral';
                icon = '✅';
            }
        }

        balanceCard.innerHTML = `
            <div class="balance-icon">${icon}</div>
            <div class="participant-name">${participant}</div>
            <div class="balance-status ${balanceClass}">${balanceText}</div>
        `;
        
        container.appendChild(balanceCard);
    }

    calculateBalancesFromPerspective(perspectiveUser) {
        const balances = {};
        this.currentGroup.participants.forEach(participant => {
            const participantName = participant.name || participant;
            balances[participantName] = 0;
        });

        // Calculate what each person paid vs what they owe
        this.currentGroup.expenses.forEach(expense => {
            // Add what the payer paid
            balances[expense.payer] += expense.amount;
            
            // Subtract what each person owes
            Object.entries(expense.splitDetails).forEach(([participant, amount]) => {
                balances[participant] -= amount;
            });
        });

        // Apply settlements
        const groupSettlements = this.settlements[this.currentGroupId] || [];
        groupSettlements.forEach(settlement => {
            balances[settlement.from] -= settlement.amount;
            balances[settlement.to] += settlement.amount;
        });

        // Calculate relative to perspective user
        const perspectiveBalance = balances[perspectiveUser];
        Object.keys(balances).forEach(participant => {
            if (participant !== perspectiveUser) {
                balances[participant] = balances[participant] - perspectiveBalance;
            }
        });

        return balances;
    }

    // Export and Share
    exportSummary() {
        const summary = this.generateSummaryText();
        const blob = new Blob([summary], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentGroup.name}_expense_summary.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('Summary exported successfully!', 'success');
    }

    exportSummaryCSV() {
        if (!this.currentGroup) {
            this.showNotification('No group selected', 'error');
            return;
        }

        const csvContent = this.generateCSVContent();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentGroup.name}_expense_summary.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('CSV exported successfully!', 'success');
    }

    exportSummaryPDF() {
        if (!this.currentGroup) {
            this.showNotification('No group selected', 'error');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Set font and styling
            doc.setFont('helvetica');
            doc.setFontSize(16);
            
            // Title
            doc.text(`EXPENSE SUMMARY - ${this.currentGroup.name.toUpperCase()}`, 20, 20);
            
            // Generated date
            doc.setFontSize(12);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 35);
            
            // Participants
            doc.setFontSize(14);
            doc.text('PARTICIPANTS:', 20, 55);
            doc.setFontSize(12);
            let yPos = 65;
            this.currentGroup.participants.forEach(participant => {
                doc.text(`- ${participant.name || participant}`, 25, yPos);
                yPos += 8;
            });
            
            // Expenses
            yPos += 10;
            doc.setFontSize(14);
            doc.text('EXPENSES:', 20, yPos);
            doc.setFontSize(12);
            yPos += 10;
            this.currentGroup.expenses.forEach(expense => {
                const expenseText = `- ${expense.description}: ${this.formatCurrency(expense.amount, expense.currency)} (${expense.category}, paid by ${expense.payer})`;
                if (expenseText.length > 50) {
                    // Split long text into multiple lines
                    const words = expenseText.split(' ');
                    let line = '';
                    let currentY = yPos;
                    words.forEach(word => {
                        if ((line + word).length > 50) {
                            doc.text(line, 25, currentY);
                            currentY += 8;
                            line = word + ' ';
                        } else {
                            line += word + ' ';
                        }
                    });
                    if (line.trim()) {
                        doc.text(line, 25, currentY);
                        currentY += 8;
                    }
                    yPos = currentY;
                } else {
                    doc.text(expenseText, 25, yPos);
                    yPos += 8;
                }
            });
            
            // Balances
            yPos += 10;
            doc.setFontSize(14);
            doc.text('BALANCES:', 20, yPos);
            doc.setFontSize(12);
            yPos += 10;
            const balances = this.calculateBalances();
            Object.entries(balances).forEach(([participant, balance]) => {
                doc.text(`- ${participant}: ${this.formatCurrency(Math.abs(balance), this.currentGroup.currency)} ${balance >= 0 ? 'owed' : 'owes'}`, 25, yPos);
                yPos += 8;
            });
            
            // Total expenses
            yPos += 10;
            const totalExpenses = this.currentGroup.expenses.reduce((sum, e) => sum + e.amount, 0);
            doc.setFontSize(14);
            doc.text(`TOTAL EXPENSES: ${this.formatCurrency(totalExpenses, this.currentGroup.currency)}`, 20, yPos);
            
            // Save the PDF
            doc.save(`${this.currentGroup.name}_expense_summary.pdf`);
            this.showNotification('PDF exported successfully!', 'success');
            
        } catch (error) {
            console.error('PDF generation error:', error);
            this.showNotification('Failed to generate PDF', 'error');
        }
    }

    shareSummary() {
        const summary = this.generateSummaryText();
        
        if (navigator.share) {
            navigator.share({
                title: `${this.currentGroup.name} Expense Summary`,
                text: summary
            });
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(summary).then(() => {
                this.showNotification('Summary copied to clipboard!', 'success');
            }).catch(() => {
                this.showNotification('Failed to copy to clipboard', 'error');
            });
        }
    }

    generateSummaryText() {
        let summary = `EXPENSE SUMMARY - ${this.currentGroup.name.toUpperCase()}\n`;
        summary += `Generated on: ${new Date().toLocaleDateString()}\n\n`;
        
        summary += `PARTICIPANTS:\n`;
        this.currentGroup.participants.forEach(participant => {
            const name = participant.name || participant;
            summary += `- ${name}\n`;
        });
        
        summary += `\nEXPENSES:\n`;
        this.currentGroup.expenses.forEach(expense => {
            summary += `- ${ExpenseSplitter.escapeHtml(expense.description)}: ${this.formatCurrency(expense.amount, expense.currency)} (${expense.category}, paid by ${expense.payer})\n`;
        });
        
        summary += `\nBALANCES:\n`;
        const balances = this.calculateBalances();
        Object.entries(balances).forEach(([participant, balance]) => {
            summary += `- ${participant}: ${this.formatCurrency(Math.abs(balance), this.currentGroup.currency)} ${balance >= 0 ? 'owed' : 'owes'}\n`;
        });
        
        summary += `\nTOTAL EXPENSES: ${this.formatCurrency(this.currentGroup.expenses.reduce((sum, e) => sum + e.amount, 0), this.currentGroup.currency)}\n`;
        
        return summary;
    }

    generateCSVContent() {
        const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
        let csv = 'Category,Description,Amount,Currency,Payer,Date\n';
        
        // Add expenses
        this.currentGroup.expenses.forEach(expense => {
            const date = expense.date ? new Date(expense.date).toLocaleDateString() : 'N/A';
            csv += `${esc(expense.category)},${esc(expense.description)},${expense.amount},${esc(expense.currency)},${esc(expense.payer)},${esc(date)}\n`;
        });
        
        csv += '\n';
        csv += 'Participant,Balance,Direction\n';
        
        // Add balances
        const balances = this.calculateBalances();
        Object.entries(balances).forEach(([participant, balance]) => {
            const direction = balance >= 0 ? 'Owed' : 'Owes';
            csv += `${esc(participant)},${Math.abs(balance)},${esc(direction)}\n`;
        });
        
        csv += '\n';
        csv += 'Summary,Value\n';
        csv += `${esc('Total Expenses')},${this.currentGroup.expenses.reduce((sum, e) => sum + e.amount, 0)}\n`;
        csv += `${esc('Total Participants')},${this.currentGroup.participants.length}\n`;
        csv += `${esc('Group Currency')},${esc(this.currentGroup.currency)}\n` + `${esc('Generated Date')},${esc(new Date().toLocaleDateString())}\n`;
        
        return csv;
    }

    // Group Summary Methods
    exportGroupSummary(groupId) {
        const group = this.groups[groupId];
        if (!group) return;
        
        const summary = this.generateGroupSummaryText(group);
        const blob = new Blob([summary], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${group.name}_expense_summary.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification(`Summary for ${group.name} exported successfully!`, 'success');
    }

    exportGroupSummaryCSV(groupId) {
        const group = this.groups[groupId];
        if (!group) return;
        
        const csvContent = this.generateGroupCSVContent(group);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${group.name}_expense_summary.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification(`CSV for ${group.name} exported successfully!`, 'success');
    }

    exportGroupSummaryPDF(groupId) {
        const group = this.groups[groupId];
        if (!group) return;
        
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Set font and styling
            doc.setFont('helvetica');
            doc.setFontSize(16);
            
            // Title
            doc.text(`EXPENSE SUMMARY - ${group.name.toUpperCase()}`, 20, 20);
            
            // Generated date
            doc.setFontSize(12);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 35);
            
            // Participants
            doc.setFontSize(14);
            doc.text('Participants:', 20, 55);
            let yPos = 65;
            group.participants.forEach(participant => {
                const participantName = participant.name || participant;
                doc.setFontSize(12);
                doc.text(`- ${participantName}`, 25, yPos);
                yPos += 8;
            });
            
            // Expenses
            yPos += 10;
            doc.setFontSize(14);
            doc.text('Expenses:', 20, yPos);
            yPos += 10;
            group.expenses.forEach(expense => {
                doc.setFontSize(12);
                const expenseText = `${expense.description}: ${this.formatCurrency(expense.amount, expense.currency)} (${expense.category}, paid by ${expense.payer})`;
                doc.text(expenseText, 25, yPos);
                yPos += 8;
            });
            
            // Balances
            yPos += 10;
            doc.setFontSize(14);
            doc.text('Balances:', 20, yPos);
            yPos += 10;
            const balances = this.calculateGroupBalances(group);
            Object.entries(balances).forEach(([participant, balance]) => {
                doc.setFontSize(12);
                const balanceText = `${participant}: ${this.formatCurrency(Math.abs(balance), group.currency)} ${balance >= 0 ? 'owed' : 'owes'}`;
                doc.text(balanceText, 25, yPos);
                yPos += 8;
            });
            
            // Total
            yPos += 10;
            doc.setFontSize(14);
            const totalExpenses = group.expenses.reduce((sum, e) => sum + e.amount, 0);
            doc.text(`Total Expenses: ${this.formatCurrency(totalExpenses, group.currency)}`, 20, yPos);
            
            // Save the PDF
            doc.save(`${group.name}_expense_summary.pdf`);
            this.showNotification('PDF exported successfully!', 'success');
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            this.showNotification('Failed to generate PDF', 'error');
        }
    }

    addExpenseToGroup(groupId) {
        // Set the group as current
        this.setCurrentGroup(groupId);
        
        // Scroll to expense section
        document.getElementById('expenseSection').scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
        
        this.showNotification(`Ready to add expenses to ${this.currentGroup.name}`, 'info');
    }

    viewGroupSummary(groupId) {
        // Set the group as current and show summary section
        this.setCurrentGroup(groupId);
        
        // Scroll to summary section
        document.getElementById('summarySection').scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
        
        this.showNotification(`Viewing summary for ${this.currentGroup.name}`, 'info');
    }

    generateGroupSummaryText(group) {
        let summary = `EXPENSE SUMMARY - ${group.name.toUpperCase()}\n`;
        summary += `Generated on: ${new Date().toLocaleDateString()}\n\n`;
        
        summary += `PARTICIPANTS:\n`;
        group.participants.forEach(participant => {
            summary += `- ${participant}\n`;
        });
        
        summary += `\nEXPENSES:\n`;
        group.expenses.forEach(expense => {
            summary += `- ${expense.description}: ${this.formatCurrency(expense.amount, expense.currency)} (${expense.category}, paid by ${expense.payer})\n`;
        });
        
        // Calculate balances for this specific group
        const balances = this.calculateGroupBalances(group);
        summary += `\nBALANCES:\n`;
        Object.entries(balances).forEach(([participant, balance]) => {
            summary += `- ${participant}: ${this.formatCurrency(Math.abs(balance), group.currency)} ${balance >= 0 ? 'owed' : 'owes'}\n`;
        });
        
        summary += `\nTOTAL EXPENSES: ${this.formatCurrency(group.expenses.reduce((sum, e) => sum + e.amount, 0), group.currency)}\n`;
        
        return summary;
    }

    calculateGroupBalances(group) {
        const balances = {};
        group.participants.forEach(participant => {
            balances[participant] = 0;
        });

        // Calculate what each person paid vs what they owe
        group.expenses.forEach(expense => {
            // Add what the payer paid
            balances[expense.payer] += expense.amount;
            
            // Subtract what each person owes
            Object.entries(expense.splitDetails).forEach(([participant, amount]) => {
                balances[participant] -= amount;
            });
        });

        // Apply settlements for this group
        const groupSettlements = this.settlements[group.id] || [];
        groupSettlements.forEach(settlement => {
            balances[settlement.from] -= settlement.amount;
            balances[settlement.to] += settlement.amount;
        });

        return balances;
    }

    generateGroupCSVContent(group) {
        const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
        let csv = 'Category,Description,Amount,Currency,Payer,Date\n';
        
        // Add expenses
        group.expenses.forEach(expense => {
            const date = expense.date ? new Date(expense.date).toLocaleDateString() : 'N/A';
            csv += `${esc(expense.category)},${esc(expense.description)},${expense.amount},${esc(expense.currency)},${esc(expense.payer)},${esc(date)}\n`;
        });
        
        csv += '\n';
        csv += 'Participant,Balance,Direction\n';
        
        // Add balances
        const balances = this.calculateGroupBalances(group);
        Object.entries(balances).forEach(([participant, balance]) => {
            const direction = balance >= 0 ? 'Owed' : 'Owes';
            csv += `${esc(participant)},${Math.abs(balance)},${esc(direction)}\n`;
        });
        
        csv += '\n';
        csv += 'Summary,Value\n';
        csv += `${esc('Total Expenses')},${group.expenses.reduce((sum, e) => sum + e.amount, 0)}\n`;
        csv += `${esc('Total Participants')},${group.participants.length}\n`;
        csv += `${esc('Group Currency')},${esc(group.currency)}\n` + `${esc('Generated Date')},${esc(new Date().toLocaleDateString())}\n`;
        
        return csv;
    }

    // Groups List (Sidebar)
    updateGroupsList() {
        const groupsListSection = document.getElementById('groupsListSection');
        const groupsList = document.getElementById('groupsList');
        
        if (Object.keys(this.groups).length === 0) {
            groupsListSection.style.display = 'none';
            return;
        }
        
        groupsListSection.style.display = 'block';
        groupsList.innerHTML = '';
        
        Object.values(this.groups).forEach(group => {
            const groupCard = document.createElement('div');
            groupCard.className = 'group-card';
            groupCard.setAttribute('data-group-id', group.id);
            
            if (group.id === this.currentGroupId) {
                groupCard.classList.add('active');
            }
            
            const totalExpenses = group.expenses.reduce((sum, expense) => sum + expense.amount, 0);
            const participantCount = group.participants.length;
            const creationDate = group.createdAt ? new Date(group.createdAt).toLocaleDateString() : 'N/A';
            
            groupCard.innerHTML = `
                <div class="group-card-header">
                    <h3>${group.name}</h3>
                    <button class="btn btn-sm btn-danger delete-group-btn" onclick="event.stopPropagation(); expenseSplitter.deleteGroup('${group.id}')">
                        <img src="public/trash-icon.png" alt="Delete" class="icon"> Delete
                    </button>
                </div>
                <div class="group-stats">
                    <span>${participantCount} participants</span>
                    <span>${group.expenses.length} expenses</span>
                    <span>${this.formatCurrency(totalExpenses, group.currency)} (${group.currency})</span>
                    <span>Created: ${creationDate}</span>
                </div>
                <div class="group-card-actions">
                    <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); expenseSplitter.addExpenseToGroup('${group.id}')">
                        <img src="public/receipt-icon.png" alt="Add Expense" class="icon"> Add Expense
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); expenseSplitter.viewGroupSummary('${group.id}')">
                        <img src="public/chart-bar-icon.png" alt="Chart" class="icon"> View Summary
                    </button>
                    <div class="export-overlay">
                        <button class="btn btn-sm btn-secondary export-btn" onclick="event.stopPropagation(); expenseSplitter.toggleGroupExportDropdown('${group.id}', event)">
                            <img src="public/download-icon.png" alt="Export" class="icon"> Export
                        </button>
                        <div class="export-overlay-content group-export-dropdown" id="groupExportDropdown-${group.id}">
                            <div class="export-option" data-format="txt" data-group-id="${group.id}">
                                <img src="public/txt-icon.png" alt="Text" class="icon-small"> Text (.txt)
                            </div>
                            <div class="export-option" data-format="csv" data-group-id="${group.id}">
                                <img src="public/csv-icon.png" alt="CSV" class="icon-small"> CSV
                            </div>
                            <div class="export-option" data-format="pdf" data-group-id="${group.id}">
                                <img src="public/pdf-icon.png" alt="PDF" class="icon-small"> PDF
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Add click event for the card (excluding buttons)
            groupCard.addEventListener('click', (e) => {
                if (!e.target.closest('.group-card-actions')) {
                    this.setCurrentGroup(group.id);
                }
            });
            
            // Add event listeners for group export options
            const exportOptions = groupCard.querySelectorAll('.export-option');
            exportOptions.forEach(option => {
                option.addEventListener('click', (e) => this.handleGroupExportOption(e));
            });
            
            groupsList.appendChild(groupCard);
        });
    }

    // Utility Functions
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
        `;
        
        // Set background color based on type using the app's color palette
        const colors = {
            success: '#859F3D',
            error: '#1A1A19',
            info: '#31511E',
            warning: '#859F3D'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    showWelcomeMessage() {
        if (Object.keys(this.groups).length === 0) {
            this.showNotification('Welcome! Create your first group to get started.', 'info');
        }
    }

    // Storage Functions
    saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }

    loadFromStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            return null;
        }
    }

    // Export Dropdown Methods
    toggleExportDropdown(event) {
        event.stopPropagation();
        const dropdown = document.getElementById('exportDropdown');
        dropdown.classList.toggle('show');
    }

    handleExportOption(event) {
        const format = event.currentTarget.dataset.format;
        const dropdown = document.getElementById('exportDropdown');
        
        // Hide dropdown
        dropdown.classList.remove('show');
        
        // Handle export based on format
        switch (format) {
            case 'txt':
                this.exportSummary();
                break;
            case 'csv':
                this.exportSummaryCSV();
                break;
            case 'pdf':
                this.exportSummaryPDF();
                break;
        }
    }

    // Group Export Dropdown Methods
    toggleGroupExportDropdown(groupId, event) {
        event.stopPropagation();
        
        // Close any other open group export dropdowns
        document.querySelectorAll('.group-export-dropdown.show').forEach(dropdown => {
            if (dropdown.id !== `groupExportDropdown-${groupId}`) {
                dropdown.classList.remove('show');
            }
        });
        
        const dropdown = document.getElementById(`groupExportDropdown-${groupId}`);
        dropdown.classList.toggle('show');
    }

    handleGroupExportOption(event) {
        const format = event.currentTarget.dataset.format;
        const groupId = event.currentTarget.dataset.groupId;
        const dropdown = document.getElementById(`groupExportDropdown-${groupId}`);
        
        // Hide dropdown
        dropdown.classList.remove('show');
        
        // Handle export based on format
        switch (format) {
            case 'txt':
                this.exportGroupSummary(groupId);
                break;
            case 'csv':
                this.exportGroupSummaryCSV(groupId);
                break;
            case 'pdf':
                this.exportGroupSummaryPDF(groupId);
                break;
        }
    }


}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize the application
let expenseSplitter;
document.addEventListener('DOMContentLoaded', () => {
    expenseSplitter = new ExpenseSplitter();
});
