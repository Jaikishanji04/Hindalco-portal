/* ==========================================
   STATE MANAGEMENT & CORE MOCK DATA
   ========================================== */

let currentRole = 'employee'; // Default login selector focus: 'employee' or 'non-employee'
let isSignupMode = false;

// Override fetch if running via file:// protocol
const originalFetch = window.fetch;
window.fetch = async function() {
    let args = Array.prototype.slice.call(arguments);
    if (window.location.protocol === 'file:' && typeof args[0] === 'string' && args[0].startsWith('/api/')) {
        args[0] = 'http://localhost:8000' + args[0];
    }
    return originalFetch.apply(this, args);
};
let currentUser = null;

// Mock database for users
let usersDb = {
    employee: [
        { staffId: 'HIND-EMP-4029', password: 'password', name: 'Jaideep Kumar', title: 'Grade M-3 Assistant Manager' }
    ],
    'non-employee': [
        { email: 'patient@gmail.com', phone: '9876543210', password: 'password', name: 'Suresh Kumar' }
    ]
};

// Mock Employee Registry (Simulating company HR database lookup)
const mockEmployeeRegistry = {
    'HIND-EMP-4029': { name: 'Jaideep Kumar', title: 'Grade M-3 Assistant Manager' },
    'HIND-EMP-1001': { name: 'Aditya Birla', title: 'Managing Director' },
    'HIND-EMP-1002': { name: 'Kumar Mangalam', title: 'Chairman' },
    'HIND-EMP-2005': { name: 'Sunil Mehta', title: 'Grade M-1 Senior Engineer' },
};

// Doctors Database
let doctorsList = [];


// Patient-Side (Non-Employee) Scheduled OPD Visits
let patientAppointments = [
    { doctor: "Dr. (Mrs.) R. Singh", dept: "Dermatology", date: "25-Jun-2026", time: "11:30 AM", token: "DER-902", patientName: "Suresh Kumar" }
];

let employeeAppointments = [];
let pocketBalance = 500;

// Corporate Wellness announcements desk
let corporateCirculars = [
    { time: "Today", title: "Mandatory Annual Health Audit", desc: "Grade M-1 to M-3 employees audit cycle starts from October 1st. Please schedule slots through the OHS portal.", priority: "medium" },
    { time: "Yesterday", title: "Health Scheme Renewal", desc: "HEHS annual limits have been automatically updated. Carry updated physical smartcards to the pharmacy counter.", priority: "low" },
    { time: "12-Jun-2026", title: "Free Health & Hygiene Camp", desc: "Hindalco Hospital is conducting a pediatric immunization & hygiene camp this Saturday at the colony club hall.", priority: "high" }
];


/* ==========================================
   INITIALIZATION & AUTHENTICATION LOGIC
   ========================================== */

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const docRes = await fetch('/api/doctors');
        if (docRes.ok) {
            const rawDocs = await docRes.json();
            doctorsList = rawDocs.map(d => ({
                id: d.id,
                name: d.name,
                spec: d.specialization,
                degree: d.degree,
                avail: d.availability_schedule,
                isAvailable: d.is_available
            }));
        }
    } catch (e) { console.warn("Failed to fetch doctors", e); }

    // Populate dropdown selection lists and registries
    populateDoctorsForDept();
    renderDoctorsFinder();
    
    

    // Set default login role view toggle
    setRole('employee');
    
    // Restore session from sessionStorage if exists
    const storedUser = sessionStorage.getItem('currentUser');
    const storedRole = sessionStorage.getItem('currentRole');
    if (storedUser && storedRole) {
        currentRole = storedRole;
        setRole(storedRole);
        loginUser(JSON.parse(storedUser));
    }
});

function removeExpiredAppointments() {
    const now = new Date();
    const hours = now.getHours();

    const filterAppts = (appts) => {
        return appts.filter(app => {
            if (app.shift === 'Morning' && hours >= 14) return false;
            if (app.shift === 'Evening' && hours >= 20) return false;
            return true;
        });
    };

    const beforeEmp = employeeAppointments.length;
    const beforePat = patientAppointments.length;

    employeeAppointments = filterAppts(employeeAppointments);
    patientAppointments = filterAppts(patientAppointments);

    if (beforeEmp !== employeeAppointments.length) renderEmployeeOPDQueueStatus();
    fetchAndRenderLabReports(true);
    fetchAndRenderPrescriptions(true);
    fetchWalletBalance();
    if (beforePat !== patientAppointments.length) renderPatientOPDQueueStatus();
    fetchAndRenderLabReports(false);
    fetchAndRenderPrescriptions(false);
}

setInterval(removeExpiredAppointments, 60000);

// Toggle between Employee and Non-Employee fields in Auth view
function adjustNameFieldVisibility() {
    const regNameGroup = document.getElementById('reg-name-group');
    if (regNameGroup) {
        const input = regNameGroup.querySelector('input');
        
        if (isSignupMode && currentRole !== 'employee') {
            regNameGroup.classList.remove('hidden');
            if (input) input.required = true;
        } else {
            regNameGroup.classList.add('hidden');
            if (input) input.required = false;
        }
    }
    
    const regPanGroup = document.getElementById('reg-pan-group');
    if (regPanGroup) {
        const panInput = regPanGroup.querySelector('input');
        if (isSignupMode && currentRole === 'employee') {
            regPanGroup.classList.remove('hidden');
            if (panInput) panInput.required = true;
        } else {
            regPanGroup.classList.add('hidden');
            if (panInput) panInput.required = false;
        }
    }
    
    const confirmPasswordGroup = document.getElementById('reg-confirm-password-group');
    if (confirmPasswordGroup) {
        const confirmInput = confirmPasswordGroup.querySelector('input');
        if (isSignupMode) {
            confirmPasswordGroup.classList.remove('hidden');
            if (confirmInput) confirmInput.required = true;
        } else {
            confirmPasswordGroup.classList.add('hidden');
            if (confirmInput) confirmInput.required = false;
        }
    }
}

// Toggle between login and signup input layouts
function toggleAuthMode(event) {
    event.preventDefault();
    isSignupMode = !isSignupMode;
    
    const formTitle = document.getElementById('auth-form-title');
    const formSubtitle = document.getElementById('auth-form-subtitle');
    const submitBtnText = document.getElementById('submit-btn-text');
    const togglePrompt = document.getElementById('toggle-text-prompt');
    const toggleLink = document.getElementById('toggle-auth-mode');
    const passwordLabel = document.getElementById('auth-password-label');
    
    if (isSignupMode) {
        formTitle.innerText = "Register Portal Account";
        formSubtitle.innerText = "Fill details to create your secure medical portal access.";
        submitBtnText.innerText = "Create Account";
        togglePrompt.innerText = "Already have an account?";
        toggleLink.innerText = "Login here";
        if (passwordLabel) passwordLabel.innerText = "Create Password";
        
        // Hide doctor option in signup
        const docBtn = document.getElementById('role-doctor');
        if (docBtn) docBtn.style.display = 'none';
        
        if (currentRole === 'doctor') {
            setRole('employee');
        }
    } else {
        formTitle.innerText = "Welcome to the Portal";
        formSubtitle.innerText = "Please enter your credentials to access the medical portal.";
        submitBtnText.innerText = "Log In";
        togglePrompt.innerText = "Don't have a portal account?";
        toggleLink.innerText = "Create Account";
        if (passwordLabel) passwordLabel.innerText = "Password";
        
        // Show doctor option in login
        const docBtn = document.getElementById('role-doctor');
        if (docBtn) docBtn.style.display = '';
    }
    
    adjustNameFieldVisibility();
}

// Submit login or sign up registration
function loginUser(user) {
    currentUser = user;
    
    // Save to sessionStorage for session persistence
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    sessionStorage.setItem('currentRole', currentRole);
    
    // Smooth transition
    document.getElementById('auth-screen').classList.remove('active');
    
    if (currentRole === 'employee') {
        const elEmpUserName = document.getElementById('emp-user-name');
        if(elEmpUserName) elEmpUserName.innerText = user.name;
        
        const elEmpUserRole = document.getElementById('emp-user-role');
        if(elEmpUserRole) elEmpUserRole.innerText = `${user.title || 'Employee'} | ${user.staffId}`;
        
        const elEmpWelcomeName = document.getElementById('emp-welcome-name');
        if(elEmpWelcomeName) elEmpWelcomeName.innerText = user.name.split(' ')[0];
        
        // Set initials avatar
        const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 1);
        const elEmpAvatarInitials = document.getElementById('emp-avatar-initials');
        if(elEmpAvatarInitials) elEmpAvatarInitials.innerText = initials;
        
        // Open Employee portal
        document.getElementById('employee-screen').classList.add('active');
        showToast(`Welcome to Hindalco Employee Portal`, 'employee');
        
        // Populate and render dashboards
        updateEmployeeDashboard();
        
    } else {
        const elPatUserName = document.getElementById('pat-user-name');
        if(elPatUserName) elPatUserName.innerText = user.name;
        
        const elPatWelcomeName = document.getElementById('pat-welcome-name');
        if(elPatWelcomeName) elPatWelcomeName.innerText = user.name.split(' ')[0];
        
        // Set initials avatar
        const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 1);
        const elPatAvatarInitials = document.getElementById('pat-avatar-initials');
        if(elPatAvatarInitials) elPatAvatarInitials.innerText = initials;
        
        // Update Patient Health Card elements
        const email = user.email || 'patient@gmail.com';
        const regId = user.regId || 'HIND-PAT-' + Math.floor(1000 + Math.random() * 9000);
        user.regId = regId;
        
        if (document.getElementById('pat-profile-avatar')) {
            document.getElementById('pat-profile-avatar').innerText = initials;
        }
        if (document.getElementById('pat-profile-name')) {
            document.getElementById('pat-profile-name').innerText = user.name;
        }
        if (document.getElementById('pat-profile-email')) {
            document.getElementById('pat-profile-email').innerText = email;
        }


        if (document.getElementById('pat-profile-reg-id')) {
            document.getElementById('pat-profile-reg-id').innerText = regId;
        }
        
        // Open Patient portal
        document.getElementById('patient-screen').classList.add('active');
        showToast(`Welcome to Patient Portal`, 'non-employee');
        
        updatePatientDashboard();
    }
}

// Logout session
function logout() {
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentRole');
    
    // Close dashboards, return to auth screen
    document.getElementById('employee-screen').classList.remove('active');
    document.getElementById('patient-screen').classList.remove('active');
    
    // Clear login inputs
    document.getElementById('auth-email').value = "";
    document.getElementById('auth-password').value = "";
    if (document.getElementById('auth-staff-id')) document.getElementById('auth-staff-id').value = "";
    if (document.getElementById('reg-name')) document.getElementById('reg-name').value = "";
    
    document.getElementById('auth-screen').classList.add('active');
    showToast(`Logged out successfully.`, currentRole);
}


/* ==========================================
   NAVIGATION ENGINE (TAB SWITCHING)
   ========================================== */

function switchTab(portalPrefix, tabId, navButtonElement = null) {
    // Find all panels for this portal
    const parentContainer = portalPrefix === 'emp' ? 'employee-screen' : 'patient-screen';
    const panels = document.querySelectorAll(`#${parentContainer} .tab-panel`);
    
    panels.forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Show chosen panel
    const targetPanel = document.getElementById(`${portalPrefix}-tab-${tabId}`);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }
    
    // Update breadcrumb
    const breadcrumb = document.querySelector(`#${parentContainer} .header-breadcrumb`);
    if (breadcrumb) {
        const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ');
        breadcrumb.innerText = `${portalPrefix === 'emp' ? 'Employee' : 'Patient'} Portal / ${capitalize(tabId)}`;
    }
    
    // Update active nav button styling
    if (navButtonElement) {
        const navItems = document.querySelectorAll(`#${parentContainer} .nav-item`);
        navItems.forEach(btn => btn.classList.remove('active'));
        navButtonElement.classList.add('active');
    } else {
        // Find nav button matching the target tab and style active if tab was loaded programmatically
        const navItems = document.querySelectorAll(`#${parentContainer} .nav-item`);
        navItems.forEach(btn => {
            const btnOnClick = btn.getAttribute('onclick');
            if (btnOnClick && btnOnClick.includes(`'${tabId}'`)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Close sidebar on mobile when tab changes
    const activeContainer = document.getElementById(parentContainer);
    if (activeContainer) {
        const sidebar = activeContainer.querySelector('.sidebar');
        const overlay = activeContainer.querySelector('.sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('show');
    }
}

// Toggle mobile navigation drawer
function toggleMobileSidebar() {
    const activeScreen = document.querySelector('.view-section.active');
    if (!activeScreen) return;
    
    const sidebar = activeScreen.querySelector('.sidebar');
    const overlay = activeScreen.querySelector('.sidebar-overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    }
}

// Global API Client with Graceful Fallback
async function apiFetch(endpoint, options = {}, fallbackData = null) {
    const API_BASE = '/api';
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(errBody.message || `HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.warn(`[API Connection Failed] falling back to local simulation for endpoint: ${endpoint}`, error);
        return fallbackData;
    }
}


/* ==========================================
   HINDALCO EMPLOYEE PORTAL RENDER LOGIC
   ========================================== */

async function updateEmployeeDashboard() {
    try {
        const circRes = await fetch('/api/circulars');
        if (circRes.ok) {
            const rawCircs = await circRes.json();
            corporateCirculars = rawCircs.map(c => ({
                id: c.id,
                title: c.title,
                desc: c.description,
                priority: c.priority,
                time: new Date(c.date_posted).toLocaleDateString()
            }));
        }
        
        const appRes = await fetch('/api/appointments', {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('hindalco_token')}` }
        });
        if (appRes.ok) {
            const rawAppts = await appRes.json();
            employeeAppointments = rawAppts.map(a => {
                const doc = doctorsList.find(d => d.id === a.doctor_id);
                return {
                    id: a.id,
                    doctor: doc ? doc.name : "Unknown Doctor",
                    dept: doc ? doc.specialization : "OPD",
                    date: a.date,
                    time: a.time_slot,
                    shift: a.shift,
                    token: a.token_number || "Pending",
                    checkedIn: false
                };
            });
        }
    } catch (e) { console.warn("API Error", e); }
    
    renderCirculars();
    renderEmployeeOPDQueueStatus();
    fetchAndRenderLabReports(true);
    fetchAndRenderPrescriptions(true);
    fetchWalletBalance();
}

// 6. Wellness bulletins render
function renderCirculars() {
    const listContainer = document.getElementById('emp-dashboard-circulars');
    const scrollerContainer = document.getElementById('emp-circulars-container');
    
    if (listContainer) {
        listContainer.innerHTML = '';
        corporateCirculars.forEach(circ => {
            let priorityClass = '';
            if (circ.priority === 'high') priorityClass = 'priority-high';
            else if (circ.priority === 'medium') priorityClass = 'priority-medium';
            else priorityClass = 'priority-low';
            
            const li = `
                <li class="bulletin-item ${priorityClass}">
                    <span class="bulletin-time">${circ.time}</span>
                    <p><strong>${circ.title}:</strong> ${circ.desc}</p>
                </li>
            `;
            listContainer.innerHTML += li;
        });
    }
    
    if (scrollerContainer) {
        scrollerContainer.innerHTML = '';
        corporateCirculars.forEach(circ => {
            const cardHTML = `
                <div class="alert-ticker-card prio-${circ.priority}">
                    <div class="ticker-header">
                        <span>Notice Category: ${circ.priority}</span>
                        <span>${circ.time}</span>
                    </div>
                    <div class="ticker-title">${circ.title}</div>
                    <div class="ticker-desc">${circ.desc}</div>
                </div>
            `;
            scrollerContainer.innerHTML += cardHTML;
        });
    }
}

// Render employee OPD live queue status
function renderEmployeeOPDQueueStatus() {
    const container = document.getElementById('emp-opd-status-list-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (employeeAppointments.length === 0) {
        container.innerHTML = `<div class="empty-state">No active OPD consultation queues. Please book an appointment to begin tracking.</div>`;
        return;
    }
    
    employeeAppointments.forEach((app, idx) => {
        let currentStep = app.checkedIn ? 3 : 1; 
        
        let queueText = '';
        if (currentStep === 3) {
            const prefix = app.token.split('-')[0] || 'GEN';
            const num = parseInt(app.token.split('-')[1]) || 102;
            queueText = `<strong>Queue Info:</strong> 3 patients ahead of you in lounge. Currently seeing: ${prefix}-${num - 3}`;
        } else {
            queueText = `<strong>Queue Info:</strong> Confirm presence by checking in. Nursing desk will record your vitals.`;
        }
        
                const steps = [
            { label: "OHC Pass", desc: "Approved" },
            { label: "Checked-In", desc: "Vitals Recorded" },
            { label: "In Queue", desc: "Waiting Lounge" },
            { label: "Consultation", desc: "Active Cabin" },
            { label: "Clearance", desc: "Return to Work" }
        ];
        
        let stepsHTML = '';
        steps.forEach((step, sIdx) => {
            const stepNum = sIdx + 1;
            let statusClass = 'pending';
            if (stepNum < currentStep) statusClass = 'completed';
            else if (stepNum === currentStep) statusClass = 'active';
            
            stepsHTML += `
                <div class="timeline-step ${statusClass}">
                    <div class="step-icon">${stepNum}</div>
                    <div class="step-info">
                        <span class="step-label">${step.label}</span>
                        <span class="step-desc">${step.desc}</span>
                    </div>
                </div>
            `;
        });
        
        const cardHTML = `
            <div class="opd-status-card">
                <div class="opd-status-header">
                    <div>
                        <h4>Consultation with ${app.doctor}</h4>
                        <span class="opd-card-dept">${app.dept}</span>
                        ${app.patientName ? `<div style="font-size: 0.85rem; color: var(--clr-text-muted); margin-top: 4px;">Patient: <strong>${app.patientName}</strong></div>` : ''}
                    </div>
                    <span class="token-badge badge-primary">OPD Token: ${app.token}</span>
                </div>
            </div>
        `;
        container.innerHTML += cardHTML;
    });
}

function simulateEmpCheckIn(index) {
    if (!employeeAppointments[index]) return;
    showToast("Processing vitals at nursing counter...", "employee");
    setTimeout(() => {
        employeeAppointments[index].checkedIn = true;
        updateEmployeeDashboard();
        showToast("Vitals: BP 120/80, Temp 98.6°F recorded. Active in waiting queue.", "employee");
    }, 1200);
}

function populateEmpDoctorsForDept() {
    const dept = document.getElementById('emp-booking-dept').value;
    const docSelect = document.getElementById('emp-booking-doctor');
    
    if (!docSelect) return;
    docSelect.innerHTML = '';
    
    const filteredDocs = doctorsList.filter(d => d.spec === dept);
    
    if (filteredDocs.length === 0) {
        docSelect.innerHTML = `<option value="" disabled selected>No doctors available in this department</option>`;
        return;
    }
    
    filteredDocs.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.name;
        const status = d.isAvailable ? '(Avail)' : '(NA)';
        opt.innerText = `${d.name} ${status}`;
        if (!d.isAvailable) opt.disabled = true;
        docSelect.appendChild(opt);
    });
}

function showEmpBookingForm() {
    document.getElementById('emp-family-selection-box').style.display = 'none';
    document.getElementById('emp-actual-booking-box').style.display = 'block';
}

function showFamilySelection() {
    document.getElementById('emp-actual-booking-box').style.display = 'none';
    document.getElementById('emp-family-selection-box').style.display = 'block';
}

async function handleEmpOPDBooking(event) {
    event.preventDefault();
    
    const dept = document.getElementById('emp-booking-dept').value;
    const doctor = document.getElementById('emp-booking-doctor').value;
    
    const now = new Date();
    const hours = now.getHours();
    
    
    const shift = hours < 12 ? 'Morning' : 'Evening';
    const formattedDate = 'Today';
    const time = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    const docObj = doctorsList.find(d => d.name === doctor);
    if (!docObj) return;

    try {
        const response = await fetch('/api/appointments', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('hindalco_token')}`
            },
            body: JSON.stringify({
                doctor_id: docObj.id,
                date: formattedDate,
                time_slot: time,
                shift: shift
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            document.getElementById('emp-booking-dept').value = '';
            document.getElementById('emp-booking-doctor').innerHTML = '<option value="" disabled selected>Select Department First</option>';
            await updateEmployeeDashboard();
            switchTab('emp', 'opd-status');
            showToast(`OPD Appointment Confirmed! Token: ${data.appointment.token_number}`, 'employee');
        } else {
            alert("Failed to book appointment.");
        }
    } catch (e) {
        console.error(e);
        alert("Error booking appointment.");
    }
}

/* ==========================================
   PATIENT PORTAL (NON-EMPLOYEE) RENDER & LOGIC
   ========================================== */

// Fetch patient dashboard state with fallback
// Fetch patient dashboard state with fallback
async function updatePatientDashboard() {
    try {
        const appRes = await fetch('/api/appointments', {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('hindalco_token')}` }
        });
        if (appRes.ok) {
            const rawAppts = await appRes.json();
            patientAppointments = rawAppts.map(a => {
                const doc = doctorsList.find(d => d.id === a.doctor_id);
                return {
                    id: a.id,
                    doctor: doc ? doc.name : "Unknown Doctor",
                    dept: doc ? doc.specialization : "OPD",
                    date: a.date,
                    time: a.time_slot,
                    shift: a.shift,
                    token: a.token_number || "Pending",
                    checkedIn: false,
                    payment_status: a.status
                };
            });
        }
    } catch (e) { console.warn("API Error", e); }
    
    renderPatientAppointments();
    renderPatientOPDQueueStatus();
    fetchAndRenderLabReports(false);
    fetchAndRenderPrescriptions(false);
}

// Render patient OPD live queue status
function renderPatientOPDQueueStatus() {
    const container = document.getElementById('opd-status-list-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (patientAppointments.length === 0) {
        container.innerHTML = `<div class="empty-state">No active OPD consultation queues. Please book an appointment to begin tracking.</div>`;
        return;
    }
    
    patientAppointments.forEach((app, idx) => {
        // Generate mock progress step indices for display:
        // The first appointment in the list can simulate "In Queue" or "Checked-In"
        // If they checked in during session, let's say it is step 3. Else default to step 1 (Token Issued).
        let currentStep = app.checkedIn ? 3 : 1; 
        
        let queueText = '';
        if (currentStep === 3) {
            const prefix = app.token.split('-')[0] || 'GEN';
            const num = parseInt(app.token.split('-')[1]) || 102;
            queueText = `<strong>Queue Info:</strong> 3 patients ahead of you in lounge. Currently seeing: ${prefix}-${num - 3}`;
        } else {
            queueText = `<strong>Queue Info:</strong> Confirm presence by checking in. Nursing desk will record your vitals.`;
        }
        
        const steps = [
            { label: "Token Issued", desc: "Confirmed" },
            { label: "Checked-In", desc: "Vitals Recorded" },
            { label: "In Queue", desc: "Waiting Lounge" },
            { label: "Consultation", desc: "Active Cabin" },
            { label: "Checkout", desc: "Prescription" }
        ];
        
        let stepsHTML = '';
        steps.forEach((step, sIdx) => {
            const stepNum = sIdx + 1;
            let statusClass = 'pending';
            if (stepNum < currentStep) statusClass = 'completed';
            else if (stepNum === currentStep) statusClass = 'active';
            
            stepsHTML += `
                <div class="timeline-step ${statusClass}">
                    <div class="step-icon">${stepNum}</div>
                    <div class="step-info">
                        <span class="step-label">${step.label}</span>
                        <span class="step-desc">${step.desc}</span>
                    </div>
                </div>
            `;
        });
        
        const cardHTML = `
            <div class="opd-status-card">
                <div class="opd-status-header">
                    <div>
                        <h4>Consultation with ${app.doctor}</h4>
                        <span class="opd-card-dept">${app.dept}</span>
                        ${app.patientName ? `<div style="font-size: 0.85rem; color: var(--clr-text-muted); margin-top: 4px;">Patient: <strong>${app.patientName}</strong></div>` : ''}
                    </div>
                    <span class="token-badge badge-primary">OPD Token: ${app.token}</span>
                </div>
            </div>
        `;
        container.innerHTML += cardHTML;
    });
}

// Simulate patient checking in at Hindalco Hospital desk
function simulateCheckIn(index) {
    if (!patientAppointments[index]) return;
    
    showToast("Processing vitals at nursing counter...", "non-employee");
    
    setTimeout(() => {
        patientAppointments[index].checkedIn = true;
        updatePatientDashboard();
        showToast("Vitals: BP 120/80, Temp 98.6°F recorded. Active in waiting queue.", "non-employee");
    }, 1200);
}


// Render Appointments List on Overview tab
function renderPatientAppointments() {
    const container = document.getElementById('patient-appointments-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (patientAppointments.length === 0) {
        container.innerHTML = `<div class="empty-state">No scheduled OPD appointments. Book one using the Booking tab.</div>`;
        return;
    }
    
    patientAppointments.forEach((app, idx) => {
        const cardHTML = `
            <div class="appointment-card">
                <div class="app-meta">
                    <span class="app-doctor">${app.doctor}</span>
                    <span class="app-dept">${app.dept}</span>
                    <div class="app-date-time">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span>${app.date} at ${app.time}</span>
                    </div>
                </div>
                <div class="app-actions">
                    <span class="token-badge">Token: ${app.token}</span>
                    <button class="btn-cancel" onclick="cancelAppointment(${idx})">Cancel</button>
                </div>
            </div>
        `;
        container.innerHTML += cardHTML;
    });
}

// Cancel Appointment from User Portal
async function cancelAppointment(index) {
    const removedApp = patientAppointments[index];
    
    const response = await apiFetch('/patient/booking/cancel', {
        method: 'POST',
        body: JSON.stringify({
            email: currentUser.email,
            index: index
        })
    });
    
    if (response && response.status === 'success') {
        await updatePatientDashboard();
        showToast(`Appointment with ${removedApp.doctor} has been cancelled.`, 'non-employee');
        return;
    }
    
    // Fallback
    patientAppointments.splice(index, 1);
    await updatePatientDashboard();
    showToast(`Appointment with ${removedApp.doctor} has been cancelled.`, 'non-employee');
}

// Populate Doctors selector depending on department chosen
function populateDoctorsForDept() {
    const dept = document.getElementById('booking-dept').value;
    const docSelect = document.getElementById('booking-doctor');
    
    if (!docSelect) return;
    docSelect.innerHTML = '';
    
    const filteredDocs = doctorsList.filter(d => d.spec === dept);
    
    if (filteredDocs.length === 0) {
        docSelect.innerHTML = `<option value="" disabled selected>No doctors available in this department</option>`;
        return;
    }
    
    filteredDocs.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.name;
        const status = d.isAvailable ? '(Avail)' : '(NA)';
        opt.innerText = `${d.name} ${status}`;
        if (!d.isAvailable) opt.disabled = true;
        docSelect.appendChild(opt);
    });
}

// Step Navigation for Patient Booking
function goToPatStep1() {
    document.getElementById('pat-step-1').style.display = 'block';
    document.getElementById('pat-step-2').style.display = 'none';
    document.getElementById('pat-step-3').style.display = 'none';
}

function goToPatStep2() {
    const name = document.getElementById('pat-booking-name').value;
    const age = document.getElementById('pat-booking-age').value;
    const gender = document.getElementById('pat-booking-gender').value;
    if (!name || !age || !gender) {
        alert("Please fill in all patient details first.");
        return;
    }
    document.getElementById('pat-step-1').style.display = 'none';
    document.getElementById('pat-step-2').style.display = 'block';
    document.getElementById('pat-step-3').style.display = 'none';
}

function goToPatStep3() {
    const dept = document.getElementById('booking-dept').value;
    const doctor = document.getElementById('booking-doctor').value;
    if (!dept || !doctor) {
        alert("Please select both department and doctor.");
        return;
    }

    // Check quota for non-employee here before payment
    const docAppointmentsCount = patientAppointments.filter(a => a.doctor === doctor).length;
    if (docAppointmentsCount >= 3) {
        alert("Sorry, the non-employee registration quota (3) is full for this doctor's shift.");
        return;
    }

    // Check for 6-day follow-up
    const patName = document.getElementById('pat-booking-name').value;
    const hasPastAppt = patientAppointments.some(a => a.patientName === patName);
    
    const payMethod = document.querySelector('input[name="pat-pay-method"]:checked').value;

    if (hasPastAppt) {
        document.getElementById('payment-amount-text').innerHTML = `Amount to Pay: <span style="color: var(--clr-primary);">₹0 (Free Follow-Up)</span>`;
        document.getElementById('payment-qr-section').style.display = 'none';
    } else {
        if (payMethod === 'pocket') {
            if (pocketBalance < 150) {
                alert("Insufficient pocket balance. Please select UPI or add funds.");
                return;
            }
            pocketBalance -= 150;
            document.getElementById('pat-pocket-bal-display').innerText = pocketBalance;
            document.getElementById('payment-amount-text').innerHTML = `Amount to Pay: <span style="color: var(--clr-primary);">₹150 (Paid via Pocket)</span>`;
            document.getElementById('payment-qr-section').style.display = 'none';
        } else {
            document.getElementById('payment-amount-text').innerHTML = `Amount to Pay: <span style="color: var(--clr-primary);">₹150</span>`;
            document.getElementById('payment-qr-section').style.display = 'block';
        }
    }

    document.getElementById('pat-step-1').style.display = 'none';
    document.getElementById('pat-step-2').style.display = 'none';
    document.getElementById('pat-step-3').style.display = 'block';
}

// Submit General OPD appointment booking form
async function handleOPDBooking(event) {
    event.preventDefault();
    
    const dept = document.getElementById('booking-dept').value;
    const doctor = document.getElementById('booking-doctor').value;
    
    const now = new Date();
    const hours = now.getHours();
    const shift = hours < 12 ? 'Morning' : 'Evening';
    const formattedDate = 'Today';
    const time = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    const docObj = doctorsList.find(d => d.name === doctor);
    if (!docObj) return;

    try {
        const response = await fetch('/api/appointments', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('hindalco_token')}`
            },
            body: JSON.stringify({
                doctor_id: docObj.id,
                date: formattedDate,
                time_slot: time,
                shift: shift
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.status === "payment_required") {
                const options = {
                    key: data.payment_details.razorpay_key_id || "mock_key", // Use real key from backend if available
                    amount: data.payment_details.amount * 100,
                    currency: data.payment_details.currency,
                    name: "Hindalco Hospital",
                    description: "OPD Appointment Fee",
                    order_id: data.payment_details.razorpay_order_id,
                    handler: async function (response) {
                        try {
                            const verifyRes = await fetch(`/api/payments/verify?order_id=${data.payment_details.order_id}&razorpay_payment_id=${response.razorpay_payment_id}&razorpay_order_id=${response.razorpay_order_id}&razorpay_signature=${response.razorpay_signature}`, {
                                method: 'POST',
                                headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('hindalco_token') }
                            });
                            if (verifyRes.ok) {
                                alert("Payment successful!");
                                document.getElementById('booking-dept').value = '';
                                document.getElementById('booking-doctor').innerHTML = '<option value="" disabled selected>Select Department First</option>';
                                await updatePatientDashboard();
                                switchTab('pat', 'opd-status');
                            } else {
                                alert("Payment verification failed.");
                            }
                        } catch (e) {
                            console.error(e);
                        }
                    },
                    prefill: {
                        name: currentUser.name,
                        email: currentUser.email || "patient@gmail.com"
                    },
                    theme: { color: "#0284c7" }
                };
                if (data.payment_details.razorpay_order_id && options.key && options.key.startsWith("rzp_") && typeof Razorpay !== 'undefined') {
                    const rzp = new Razorpay(options);
                    rzp.open();
                } else {
                    alert("Demo Mode: Simulating secure Razorpay transaction...");
                    await fetch(`/api/payments/verify?order_id=${data.payment_details.order_id}&razorpay_payment_id=mock_pay_id&razorpay_order_id=mock_order_id&razorpay_signature=mock_sig`, { method: 'POST', headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('hindalco_token') } });
                    document.getElementById('booking-dept').value = '';
                    document.getElementById('booking-doctor').innerHTML = '<option value="" disabled selected>Select Department First</option>';
                    await updatePatientDashboard();
                    switchTab('pat', 'opd-status');
                }
            }
            
            document.getElementById('booking-dept').value = '';
            document.getElementById('booking-doctor').innerHTML = '<option value="" disabled selected>Select Department First</option>';
            await updatePatientDashboard();
            switchTab('pat', 'opd-status');
            showToast(`OPD Appointment Updated!`, 'non-employee');
            
            // Reset wizard UI
            document.getElementById('pat-booking-name').value = '';
            document.getElementById('pat-booking-age').value = '';
            document.getElementById('pat-booking-gender').value = '';
            goToPatStep1();
        } else {
            alert("Failed to book appointment.");
        }
    } catch (e) {
        console.error(e);
        alert("Error booking appointment.");
    }
}

// Render dynamic Doctor Finder listing cards
function renderDoctorsFinder() {
    const container = document.getElementById('doctors-list-container');
    if (!container) return;
    
    container.innerHTML = '';
    doctorsList.forEach(d => {
        const initials = d.name.replace('Dr. ', '').replace('(Mrs.) ', '').split(' ').map(n => n[0]).join('').substring(0, 1);
        
        const cardHTML = `
            <div class="doctor-card" data-search="${d.name.toLowerCase()} ${d.spec.toLowerCase()}">
                <div class="doc-avatar-box">${initials}</div>
                <div class="doc-details">
                    <span class="doc-spec">${d.spec}</span>
                    <h4>${d.name}</h4>
                    <span class="doc-degree">${d.degree}</span>
                    <span class="doc-avail">Available: ${d.avail}</span>
                </div>
            </div>
        `;
        container.innerHTML += cardHTML;
    });
}

// Filter Doctors cards in Doctor Finder search input
function filterDoctors() {
    const query = document.getElementById('doctor-search').value.toLowerCase();
    const cards = document.querySelectorAll('#doctors-list-container .doctor-card');
    
    cards.forEach(card => {
        const searchText = card.getAttribute('data-search');
        if (searchText.includes(query)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

// Lab report download simulation
function simulateDownload(filename) {
    const roleType = currentRole === 'employee' ? 'employee' : 'non-employee';
    showToast(`Downloading health record: ${filename}...`, roleType);
    
    setTimeout(() => {
        const dummyElement = document.createElement('a');
        dummyElement.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent('Verified Medical Diagnostics Report - Hindalco Hospital Renukoot'));
        dummyElement.setAttribute('download', filename);
        dummyElement.style.display = 'none';
        document.body.appendChild(dummyElement);
        dummyElement.click();
        document.body.removeChild(dummyElement);
        showToast(`Download finished.`, roleType);
    }, 1500);
}// Mock reports detailed database
const mockReportsData = {
    lipid: {
        title: "Lipid Profile & Blood Glucose Panel",
        date: "15-Jun-2026",
        referredBy: "Dr. Ajay Sharma",
        remarks: "Serum Cholesterol is slightly elevated. Patient is advised to restrict saturated fats, include more high-fiber foods, and engage in daily physical exercise. Blood Glucose levels are within normal limits.",
        pdf: "Lipid_Sugar_Report.pdf",
        results: [
            { param: "Fast Blood Glucose", value: "92 mg/dL", range: "70 - 100 mg/dL", status: "normal" },
            { param: "Total Cholesterol", value: "228 mg/dL", range: "< 200 mg/dL", status: "high" },
            { param: "Triglycerides", value: "145 mg/dL", range: "< 150 mg/dL", status: "normal" },
            { param: "HDL Cholesterol", value: "42 mg/dL", range: "> 40 mg/dL", status: "normal" },
            { param: "LDL Cholesterol", value: "157 mg/dL", range: "< 100 mg/dL", status: "high" }
        ]
    },
    allergy: {
        title: "Dermatology Allergy Sensitivity Panel",
        date: "22-May-2026",
        referredBy: "Dr. (Mrs.) R. Singh",
        remarks: "Borderline IgE sensitivity detected for dust mites and pollen. Suggest lifestyle hygiene controls and antihistamines as prescribed.",
        pdf: "Allergy_Biopsy_Report.pdf",
        results: [
            { param: "Total Serum IgE", value: "185 kU/L", range: "< 100 kU/L", status: "high" },
            { param: "House Dust Mite IgE", value: "Class 2 (Moderate)", range: "Class 0 (Negative)", status: "high" },
            { param: "Grass Pollen IgE", value: "Class 1 (Low)", range: "Class 0 (Negative)", status: "high" },
            { param: "Egg White IgE", value: "Class 0 (Negative)", range: "Class 0 (Negative)", status: "normal" }
        ]
    }
};

// Open Diagnostics Modal with detailed values
function openReportModal(reportKey) {
    const report = mockReportsData[reportKey];
    if (!report) return;
    
    const modal = document.getElementById('report-modal');
    if (!modal) return;
    
    // Bind Patient Information
    const email = currentUser ? (currentUser.email || 'patient@gmail.com') : 'patient@gmail.com';
    const regId = currentUser ? (currentUser.regId || 'HIND-PAT-1082') : 'HIND-PAT-1082';
    const name = currentUser ? currentUser.name : 'Suresh Kumar';
    
    document.getElementById('modal-report-title').innerText = report.title;
    document.getElementById('modal-report-meta').innerText = `Hindalco Pathology Lab | Date: ${report.date}`;
    document.getElementById('modal-patient-name').innerText = name;

    document.getElementById('modal-patient-reg-id').innerText = regId;
    document.getElementById('modal-patient-referred').innerText = report.referredBy;
    document.getElementById('modal-report-remarks').innerText = report.remarks;
    
    const downloadBtn = document.getElementById('modal-download-btn');
    if (downloadBtn) {
        downloadBtn.onclick = () => simulateDownload(report.pdf);
    }
    
    // Bind results table
    const tbody = document.getElementById('modal-report-tbody');
    tbody.innerHTML = '';
    
    report.results.forEach(res => {
        const tr = document.createElement('tr');
        let statusBadge = `<span class="report-status normal">Normal</span>`;
        if (res.status === 'high') {
            statusBadge = `<span class="report-status high" style="background-color: #fee2e2; color: #ef4444; border: 1px solid #fca5a5; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">High</span>`;
        } else if (res.status === 'low') {
            statusBadge = `<span class="report-status low" style="background-color: #fef3c7; color: #d97706; border: 1px solid #fcd34d; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Low</span>`;
        }
        
        tr.innerHTML = `
            <td><strong>${res.param}</strong></td>
            <td><code>${res.value}</code></td>
            <td>${res.range}</td>
            <td>${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });
    
    modal.classList.remove('hidden');
}

// Close Diagnostics Modal
function closeReportModal() {
    const modal = document.getElementById('report-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Toggle disease accordion panel in Basic Medical Care directory
function toggleAccordion(triggerElement) {
    const item = triggerElement.parentElement;
    const chevron = triggerElement.querySelector('.acc-chevron');
    
    // Toggle active state of this card
    item.classList.toggle('active');
    
    // Rotate chevron
    if (item.classList.contains('active')) {
        if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else {
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
}

// Search and filter common diseases and dietary minerals
function filterMedicalCare() {
    const query = document.getElementById('medical-search-input').value.toLowerCase();
    
    // 1. Filter Disease Accordions
    const diseaseItems = document.querySelectorAll('#medical-disease-accordions .accordion-item');
    diseaseItems.forEach(item => {
        const searchText = item.getAttribute('data-search') || '';
        if (searchText.includes(query)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
    
    // 2. Filter Mineral Cards
    const mineralCards = document.querySelectorAll('#medical-minerals-list .mineral-card');
    mineralCards.forEach(card => {
        const searchText = card.getAttribute('data-search') || '';
        if (searchText.includes(query)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}


/* ==========================================
   GLOBAL UTILITIES: TOAST NOTIFICATIONS
   ========================================== */

function showToast(message, type = 'non-employee') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'employee' ? '' : 'toast-patient'}`;
    
    toast.innerHTML = `
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // Self-destruct after 4.5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}

/* ==========================================
   MEDICAL CARE / DISEASES TAB LOGIC
   ========================================== */

function toggleAccordion(triggerElement) {
    const parentItem = triggerElement.closest('.accordion-item');
    if (parentItem) {
        parentItem.classList.toggle('active');
    }
}

function filterMedicalCare() {
    // Find the currently active tab panel to isolate the search
    const activePanel = document.querySelector('.tab-panel.active');
    if (!activePanel) return;

    const searchInput = activePanel.querySelector('.medical-search-bar input');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    // Filter Diseases within the active panel
    const diseases = activePanel.querySelectorAll('.medical-diseases-column .accordion-item');
    diseases.forEach(item => {
        const searchText = item.getAttribute('data-search') || '';
        const titleText = item.querySelector('span') ? item.querySelector('span').innerText.toLowerCase() : '';
        if (searchText.includes(query) || titleText.includes(query)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });

    // Filter Minerals within the active panel
    const minerals = activePanel.querySelectorAll('.medical-minerals-column .mineral-card');
    minerals.forEach(card => {
        const searchText = card.getAttribute('data-search') || '';
        const titleText = card.querySelector('h5') ? card.querySelector('h5').innerText.toLowerCase() : '';
        if (searchText.includes(query) || titleText.includes(query)) {
            card.style.display = ''; 
        } else {
            card.style.display = 'none';
        }
    });
}



// --- NEW DYNAMIC AUTH LOGIC OVERRIDES ---
async function handleAuthSubmit(event) {
    event.preventDefault();
    
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    errorEl.classList.add('hidden');
    
    let username = "";
    if (currentRole === 'employee') {
        username = document.getElementById('auth-staff-id').value.trim();
    } else if (currentRole === 'doctor') {
        // Assume doctor uses email for now, or we can use auth-email field.
        // Wait, did we add a specific field for doctor? No, they use the non-employee email field right now.
        // Let's just use the email field.
        username = document.getElementById('auth-email').value.trim();
    } else {
        username = document.getElementById('auth-email').value.trim();
    }

    if (isSignupMode) {
        const confirmPassword = document.getElementById('reg-confirm-password').value;
        if (password !== confirmPassword) {
            errorEl.innerText = "Passwords do not match.";
            errorEl.classList.remove('hidden');
            return;
        }

        const name = document.getElementById('reg-name').value.trim();
        let payload = { role: currentRole, password: password, name: name || "User" };

        if (currentRole === 'employee') {
            payload.staff_id = username;
        } else {
            const isEmail = username.includes('@');
            if(isEmail) payload.email = username;
            else payload.phone = username;
        }
        
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Registration failed');
            }
            // Auto login after signup
            await performLogin(username, password);
        } catch (err) {
            errorEl.innerText = err.message;
            errorEl.classList.remove('hidden');
        }
    } else {
        // Login flow
        try {
            await performLogin(username, password);
        } catch (err) {
            errorEl.innerText = err.message;
            errorEl.classList.remove('hidden');
        }
    }
}

async function performLogin(username, password) {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
    });
    
    if (!res.ok) {
        throw new Error('Invalid credentials');
    }
    const data = await res.json();
    sessionStorage.setItem('hindalco_token', data.access_token);
    
    // Fetch user details
    const meRes = await fetch('/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + data.access_token }
    });
    const userData = await meRes.json();
    sessionStorage.setItem('hindalco_user', JSON.stringify(userData));
    currentUser = userData;
    
    // Transition to appropriate view
    document.getElementById('auth-screen').classList.remove('active');
    
    if (currentUser.role === 'employee') {
        document.getElementById('employee-screen').classList.add('active');
        switchTab('emp', 'book-opd');
        updateHeaderUI('emp');
    } else if (currentUser.role === 'doctor' || currentUser.role === 'admin') {
        document.getElementById('doctor-screen').classList.add('active');
        if (currentUser.role === 'admin') {
            const adminForms = document.getElementById('admin-action-forms');
            if (adminForms) adminForms.style.display = 'grid';
            document.getElementById('doc-name').innerText = "Admin Portal";
        } else {
            document.getElementById('doc-name').innerText = currentUser.name;
        }
        switchTab('doc', 'dashboard');
        updateHeaderUI('doc');
        if (typeof fetchDoctorData === 'function') fetchDoctorData();
    } else {
        document.getElementById('patient-screen').classList.add('active');
        switchTab('pat', 'book-opd');
        updateHeaderUI('pat');
    }
    
    initData(); // Fetch dynamic data
}

function logout() {
    sessionStorage.removeItem('hindalco_token');
    sessionStorage.removeItem('hindalco_user');
    currentUser = null;
    
    document.getElementById('employee-screen').classList.remove('active');
    document.getElementById('patient-screen').classList.remove('active');
    
    const docView = document.getElementById('doctor-screen');
    if (docView) docView.classList.remove('active');
    
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('auth-form').reset();
}

// ----------------------------------------



async function fetchDoctorData() {
    try {
        const res = await fetch('/api/admin/appointments', {
            headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('hindalco_token') }
        });
        if (!res.ok) throw new Error("Failed to fetch appointments");
        const appts = await res.json();
        
        const list = document.getElementById('doc-appointments-list');
        list.innerHTML = '';
        if (appts.length === 0) {
            list.innerHTML = '<tr><td colspan="4" style="text-align: center;">No appointments found.</td></tr>';
            return;
        }
        
        appts.forEach(appt => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${appt.id}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${appt.user_id}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                    <span style="background: ${appt.status === 'pending' ? '#fef3c7' : '#dcfce7'}; color: ${appt.status === 'pending' ? '#92400e' : '#166534'}; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">${appt.status}</span>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                    <button onclick="updateAppointmentStatus(${appt.id}, 'completed')" style="background: #10b981; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Complete</button>
                    <button onclick="updateAppointmentStatus(${appt.id}, 'cancelled')" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; margin-left: 5px;">Cancel</button>
                </td>
            `;
            list.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

async function updateAppointmentStatus(id, status) {
    try {
        const res = await fetch(`/api/admin/appointments/${id}?status=${status}`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('hindalco_token') }
        });
        if (res.ok) {
            fetchDoctorData();
        }
    } catch (err) {
        console.error(err);
    }
}

async function submitLabReport() {
    const userId = document.getElementById('lab-user-id').value;
    const testName = document.getElementById('lab-test-name').value;
    const resultValue = document.getElementById('lab-result').value;
    const refRange = document.getElementById('lab-ref').value;
    
    if(!userId || !testName || !resultValue) {
        alert("Please fill all required fields");
        return;
    }
    
    const payload = {
        test_name: testName,
        result_value: resultValue,
        reference_range: refRange,
        status: "Completed"
    };
    
    try {
        const res = await fetch(`/api/admin/lab_reports?user_id=${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + sessionStorage.getItem('hindalco_token')
            },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            document.getElementById('doc-lab-form').reset();
            const statusMsg = document.getElementById('lab-report-status');
            statusMsg.style.display = 'block';
            setTimeout(() => { statusMsg.style.display = 'none'; }, 3000);
        } else {
            alert("Failed to upload report");
        }
    } catch (err) {
        console.error(err);
        alert("Error uploading report");
    }
}



function setRole(role) {
    currentRole = role;
    
    const nonEmpBtn = document.getElementById('role-non-employee');
    const empBtn = document.getElementById('role-employee');
    const docBtn = document.getElementById('role-doctor');
    const employeeIdGroup = document.querySelector('.employee-only');
    const nonEmployeeGroup = document.querySelector('.non-employee-only');
    
    // reset all buttons
    if (nonEmpBtn) nonEmpBtn.classList.remove('active');
    if (empBtn) empBtn.classList.remove('active');
    if (docBtn) docBtn.classList.remove('active');
    
    if (role === 'employee') {
        if (empBtn) empBtn.classList.add('active');
        employeeIdGroup.classList.remove('hidden');
        employeeIdGroup.querySelector('input').required = true;
        
        nonEmployeeGroup.classList.add('hidden');
        nonEmployeeGroup.querySelector('input').required = false;
        document.getElementById('email-label').innerText = "Email / Mobile Number";
        
        document.body.classList.remove('role-non-employee-focus');
    } else if (role === 'doctor') {
        if (docBtn) docBtn.classList.add('active');
        employeeIdGroup.classList.add('hidden');
        employeeIdGroup.querySelector('input').required = false;
        
        nonEmployeeGroup.classList.remove('hidden');
        nonEmployeeGroup.querySelector('input').required = true;
        document.getElementById('email-label').innerText = "Doctor Email";
        
        document.body.classList.add('role-non-employee-focus');
    } else {
        if (nonEmpBtn) nonEmpBtn.classList.add('active');
        employeeIdGroup.classList.add('hidden');
        employeeIdGroup.querySelector('input').required = false;
        
        nonEmployeeGroup.classList.remove('hidden');
        nonEmployeeGroup.querySelector('input').required = true;
        document.getElementById('email-label').innerText = "Email / Mobile Number";
        
        document.body.classList.add('role-non-employee-focus');
    }
    
    adjustNameFieldVisibility();
    
    // Clear errors when toggling roles
    document.getElementById('auth-error').classList.add('hidden');
}


// --- LAB REPORTS INTEGRATION ---
async function fetchAndRenderLabReports(isEmployee) {
    const tbodyId = isEmployee ? 'emp-lab-tbody' : 'pat-lab-tbody';
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="4">Loading reports...</td></tr>';
    try {
        const reports = await apiFetch('/api/lab_reports', {}, []);
        if (!reports || reports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No lab reports found.</td></tr>';
            return;
        }
        
        tbody.innerHTML = reports.map(r => {
            const statusColor = r.status.toLowerCase() === 'completed' ? '#166534' : '#92400e';
            const statusBg = r.status.toLowerCase() === 'completed' ? '#dcfce7' : '#fef3c7';
            return `<tr>
                <td>${currentUser.name}</td>
                <td><strong>${r.test_name}</strong><br><small>Result: ${r.result_value} (Ref: ${r.reference_range})</small></td>
                <td>Hindalco Pathology Lab</td>
                <td>
                    <div class="action-buttons-row" style="display:flex; gap:8px;">
                        <span class="status-badge" style="background:${statusBg};color:${statusColor};padding:4px 8px;border-radius:4px;font-size:0.85rem;">${r.status}</span>
                        ${r.status.toLowerCase() === 'completed' ? `<button class="submit-btn blue-btn btn-sm" onclick="alert('Viewing report ID: ${r.id}')" style="padding: 6px 12px; font-size: 0.75rem; width: auto; margin:0;">View Online</button>` : ''}
                    </div>
                </td>
            </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4">Error loading reports.</td></tr>';
    }
}

// Override switchTab to intercept lab reports click if necessary, or just call it from dashboards


// --- NEW FEATURES: Prescriptions, Circulars, Wallet ---
async function fetchAndRenderPrescriptions(isEmployee) {
    const tbodyId = isEmployee ? 'emp-prescriptions-tbody' : 'pat-prescriptions-tbody';
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    try {
        const prescriptions = await apiFetch('/api/prescriptions', {}, []);
        if (!prescriptions || prescriptions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No prescriptions found.</td></tr>';
            return;
        }

        tbody.innerHTML = prescriptions.map(p => `
            <tr>
                <td>${new Date(p.date).toLocaleDateString()}</td>
                <td>Dr. ID ${p.doctor_id}</td>
                <td>${p.medication_details}</td>
                <td>${p.notes || ''}</td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4">Error loading prescriptions.</td></tr>';
    }
}

async function fetchWalletBalance() {
    const el = document.getElementById('emp-wallet-balance');
    if (!el) return;
    try {
        const data = await apiFetch('/api/wallet/balance', {}, {balance: 0});
        el.innerText = '₹' + data.balance.toFixed(2);
    } catch (e) {
        console.error(e);
    }
}

async function handleWritePrescription(e) {
    e.preventDefault();
    const userId = document.getElementById('presc-user-id').value;
    const meds = document.getElementById('presc-meds').value;
    const notes = document.getElementById('presc-notes').value;

    try {
        await apiFetch('/api/admin/prescriptions', {
            method: 'POST',
            body: JSON.stringify({
                user_id: parseInt(userId),
                medication_details: meds,
                notes: notes
            })
        });
        alert('Prescription issued successfully!');
        e.target.reset();
    } catch (err) {
        alert('Failed to issue prescription');
    }
}

async function handlePostCircular(e) {
    e.preventDefault();
    const title = document.getElementById('circ-title').value;
    const priority = document.getElementById('circ-priority').value;
    const desc = document.getElementById('circ-desc').value;

    try {
        await apiFetch('/api/admin/circulars', {
            method: 'POST',
            body: JSON.stringify({
                title: title,
                priority: priority,
                description: desc
            })
        });
        alert('Announcement posted successfully!');
        e.target.reset();
        
        // Refresh circulars
        const circs = await apiFetch('/api/circulars', {}, []);
        if (circs) corporateCirculars = circs;
        renderCirculars();
        
    } catch (err) {
        alert('Failed to post announcement');
    }
}


// --- DOCTOR LAB REPORT UPLOAD ---
async function handleUploadLabReport(e) {
    e.preventDefault();
    const userId = document.getElementById('lab-user-id').value;
    const testName = document.getElementById('lab-test-name').value;
    const resultValue = document.getElementById('lab-result').value;
    const refRange = document.getElementById('lab-ref').value;
    const status = document.getElementById('lab-status').value;

    try {
        await apiFetch(`/api/admin/lab_reports?user_id=${userId}`, {
            method: 'POST',
            body: JSON.stringify({
                test_name: testName,
                result_value: resultValue,
                reference_range: refRange,
                status: status
            })
        });
        alert('Lab Report uploaded successfully!');
        e.target.reset();
    } catch (err) {
        alert('Failed to upload lab report');
    }
}

// --- APPOINTMENT STATUS MANAGEMENT ---
async function updateAppointmentStatus(apptId, newStatus) {
    if (!confirm(`Are you sure you want to mark appointment ${apptId} as ${newStatus}?`)) return;
    
    try {
        await apiFetch(`/api/admin/appointments/${apptId}?status=${newStatus}`, {
            method: 'PUT'
        });
        alert(`Appointment ${apptId} updated to ${newStatus}`);
        
        // Refresh doctor dashboard by simulating tab switch
        switchTab('doc', 'dashboard', document.querySelector('.nav-item.active'));
    } catch(e) {
        alert('Failed to update appointment status');
    }
}


// --- NEW DYNAMIC AUTH LOGIC OVERRIDES ---
async function handleAuthSubmit(event) {
    event.preventDefault();
    
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    errorEl.classList.add('hidden');
    
    let username = "";
    if (currentRole === 'employee') {
        username = document.getElementById('auth-staff-id').value.trim();
    } else if (currentRole === 'doctor') {
        // Assume doctor uses email for now, or we can use auth-email field.
        // Wait, did we add a specific field for doctor? No, they use the non-employee email field right now.
        // Let's just use the email field.
        username = document.getElementById('auth-email').value.trim();
    } else {
        username = document.getElementById('auth-email').value.trim();
    }

    if (isSignupMode) {
        const confirmPassword = document.getElementById('reg-confirm-password').value;
        if (password !== confirmPassword) {
            errorEl.innerText = "Passwords do not match.";
            errorEl.classList.remove('hidden');
            return;
        }

        const name = document.getElementById('reg-name').value.trim();
        let payload = { role: currentRole, password: password, name: name || "User" };

        if (currentRole === 'employee') {
            payload.staff_id = username;
        } else {
            const isEmail = username.includes('@');
            if(isEmail) payload.email = username;
            else payload.phone = username;
        }
        
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Registration failed');
            }
            // Auto login after signup
            await performLogin(username, password);
        } catch (err) {
            errorEl.innerText = err.message;
            errorEl.classList.remove('hidden');
        }
    } else {
        // Login flow
        try {
            await performLogin(username, password);
        } catch (err) {
            errorEl.innerText = err.message;
            errorEl.classList.remove('hidden');
        }
    }
}

async function performLogin(username, password) {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
    });
    
    if (!res.ok) {
        throw new Error('Invalid credentials');
    }
    const data = await res.json();
    sessionStorage.setItem('hindalco_token', data.access_token);
    
    // Fetch user details
    const meRes = await fetch('/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + data.access_token }
    });
    const userData = await meRes.json();
    sessionStorage.setItem('hindalco_user', JSON.stringify(userData));
    currentUser = userData;
    
    // Transition to appropriate view
    document.getElementById('auth-screen').classList.remove('active');
    
    if (currentUser.role === 'employee') {
        document.getElementById('emp-view').classList.remove('hidden');
        switchTab('emp', 'book-opd');
        updateHeaderUI('emp');
    } else if (currentUser.role === 'doctor' || currentUser.role === 'admin') {
        document.getElementById('doc-view').classList.remove('hidden');
        switchTab('doc', 'dashboard');
        updateHeaderUI('doc');
        fetchDoctorData();
    } else {
        document.getElementById('pat-view').classList.remove('hidden');
        switchTab('pat', 'book-opd');
        updateHeaderUI('pat');
    }
    
    initData(); // Fetch dynamic data
}

function logout() {
    sessionStorage.removeItem('hindalco_token');
    sessionStorage.removeItem('hindalco_user');
    currentUser = null;
    
    document.getElementById('emp-view').classList.add('hidden');
    document.getElementById('pat-view').classList.add('hidden');
    
    const docView = document.getElementById('doc-view');
    if (docView) docView.classList.add('hidden');
    
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('auth-form').reset();
}

// ----------------------------------------


// OVERRIDE LOGOUT TO FIX DUPLICATES AND ERRORS
window.logout = function() {
    console.log("Logout triggered");
    sessionStorage.removeItem('user');
    sessionStorage.clear();
    
    const screens = document.querySelectorAll('.view-section');
    screens.forEach(screen => screen.classList.remove('active'));
    
    const authScreen = document.getElementById('auth-screen');
    if (authScreen) authScreen.classList.add('active');
};


// OVERRIDE PERFORMLOGIN TO FIX TRANSITION ERROR
window.performLogin = async function(username, password) {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
    });
    
    if (!res.ok) {
        throw new Error('Invalid credentials');
    }
    const data = await res.json();
    sessionStorage.setItem('hindalco_token', data.access_token);
    
    // Fetch user details
    const meRes = await fetch('/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + data.access_token }
    });
    const userData = await meRes.json();
    sessionStorage.setItem('hindalco_user', JSON.stringify(userData));
    currentUser = userData;
    
    // Transition to appropriate view
    const authScreen = document.getElementById('auth-screen');
    if (authScreen) authScreen.classList.remove('active');
    
    if (currentUser.role === 'employee') {
        const empScreen = document.getElementById('employee-screen');
        if (empScreen) empScreen.classList.add('active');
        if (typeof switchTab === 'function') switchTab('emp', 'book-opd');
        if (typeof updateHeaderUI === 'function') updateHeaderUI('emp');
    } else if (currentUser.role === 'doctor' || currentUser.role === 'admin') {
        const docScreen = document.getElementById('doctor-screen');
        if (docScreen) docScreen.classList.add('active');
        if (typeof switchTab === 'function') switchTab('doc', 'dashboard');
        if (typeof updateHeaderUI === 'function') updateHeaderUI('doc');
        if (typeof fetchDoctorData === 'function') fetchDoctorData();
    } else {
        const patScreen = document.getElementById('patient-screen');
        if (patScreen) patScreen.classList.add('active');
        if (typeof switchTab === 'function') switchTab('pat', 'book-opd');
        if (typeof updateHeaderUI === 'function') updateHeaderUI('pat');
    }
    
    if (typeof initData === 'function') initData();
};


// OVERRIDE HANDLEAUTHSUBMIT TO USE GLOBAL PERFORMLOGIN
window.handleAuthSubmit = async function(event) {
    event.preventDefault();
    
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    if (errorEl) errorEl.classList.add('hidden');
    
    let username = "";
    if (typeof currentRole === 'undefined') {
        window.currentRole = 'non-employee'; // default
    }
    
    if (currentRole === 'employee') {
        username = document.getElementById('auth-staff-id').value.trim();
    } else {
        username = document.getElementById('auth-email').value.trim();
    }

    if (typeof isSignupMode !== 'undefined' && isSignupMode) {
        const confirmPassword = document.getElementById('reg-confirm-password').value;
        if (password !== confirmPassword) {
            if (errorEl) {
                errorEl.innerText = "Passwords do not match.";
                errorEl.classList.remove('hidden');
            }
            return;
        }

        const name = document.getElementById('reg-name').value.trim();
        let payload = { role: currentRole, password: password, name: name || "User" };

        if (currentRole === 'employee') {
            payload.staff_id = username;
        } else {
            const isEmail = username.includes('@');
            if(isEmail) payload.email = username;
            else payload.phone = username;
        }
        
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Registration failed');
            }
            // Auto login after signup
            await window.performLogin(username, password);
        } catch (err) {
            if (errorEl) {
                errorEl.innerText = err.message;
                errorEl.classList.remove('hidden');
            }
        }
    } else {
        // Login flow
        try {
            await window.performLogin(username, password);
        } catch (err) {
            if (errorEl) {
                errorEl.innerText = err.message;
                errorEl.classList.remove('hidden');
            }
        }
    }
};


// --- FINAL LOGIN FLOW FIX ---
window.performLogin = async function(username, password) {
    const expectedRole = (typeof currentRole !== 'undefined') ? currentRole : (window.currentRole || 'non-employee');
    
    // --- MOCK DOCTOR LOGIN ---
    if (expectedRole === 'doctor') {
        if (username.trim().toLowerCase() === 'doctor@hindalco.com' && password.trim() === 'doctor123') {
            const mockDoctorData = {
                id: 999,
                name: 'Dr. Admin Mock',
                email: 'doctor@hindalco.com',
                role: 'doctor',
                title: 'Chief Medical Officer'
            };
            sessionStorage.setItem('hindalco_token', 'mock_doctor_token_123');
            sessionStorage.setItem('hindalco_user', JSON.stringify(mockDoctorData));
            window.currentUser = mockDoctorData;
            window.currentRole = 'doctor';
            
            // Route explicitly to doctor portal (bypassing loginUser which is broken for doctors)
            const authScreen = document.getElementById('auth-screen');
            if (authScreen) authScreen.classList.remove('active');
            const docScreen = document.getElementById('doctor-screen');
            if (docScreen) docScreen.classList.add('active');
            document.getElementById('doc-name').innerText = mockDoctorData.name;
            switchTab('doc', 'dashboard');
            
            if (typeof initData === 'function') initData();
            return;
        } else {
            throw new Error('Invalid Doctor credentials. Please use doctor@hindalco.com / doctor123');
        }
    }
    // --- END MOCK DOCTOR LOGIN ---

    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
    });
    
    if (!res.ok) {
        throw new Error('Invalid credentials');
    }
    const data = await res.json();
    
    // Fetch user details
    const meRes = await fetch('/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + data.access_token }
    });
    const userData = await meRes.json();
    
    // VERIFICATION: Check if the user's actual role matches the portal they are trying to log into.
    if (expectedRole === 'doctor' && userData.role !== 'doctor' && userData.role !== 'admin') {
        throw new Error('Unauthorized: You are not a registered Doctor.');
    }
    if (expectedRole === 'employee' && userData.role !== 'employee') {
        throw new Error('Unauthorized: You are not a registered Employee.');
    }
    
    sessionStorage.setItem('hindalco_token', data.access_token);
    sessionStorage.setItem('hindalco_user', JSON.stringify(userData));
    
    // Update global variables
    window.currentUser = userData;
    window.currentRole = userData.role;
    
    // Use the existing loginUser function to handle UI updates and transitions if available
    if (typeof loginUser === 'function') {
        loginUser(userData);
    } else {
        // Fallback transition
        const authScreen = document.getElementById('auth-screen');
        if (authScreen) authScreen.classList.remove('active');
        
        if (userData.role === 'employee') {
            const empScreen = document.getElementById('employee-screen');
            if (empScreen) empScreen.classList.add('active');
        } else if (userData.role === 'doctor' || userData.role === 'admin') {
            const docScreen = document.getElementById('doctor-screen');
            if (docScreen) docScreen.classList.add('active');
        } else {
            const patScreen = document.getElementById('patient-screen');
            if (patScreen) patScreen.classList.add('active');
        }
    }
    
    if (typeof initData === 'function') initData();
};

window.handleAuthSubmit = async function(event) {
    event.preventDefault();
    
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    if (errorEl) errorEl.classList.add('hidden');
    
    let username = "";
    if (typeof currentRole === 'undefined') {
        window.currentRole = 'non-employee'; // default
    }
    
    if (currentRole === 'employee') {
        const staffEl = document.getElementById('auth-staff-id');
        username = staffEl ? staffEl.value.trim() : "";
    } else {
        const emailEl = document.getElementById('auth-email');
        username = emailEl ? emailEl.value.trim() : "";
    }

    if (typeof isSignupMode !== 'undefined' && isSignupMode) {
        const confirmEl = document.getElementById('reg-confirm-password');
        const confirmPassword = confirmEl ? confirmEl.value : "";
        if (password !== confirmPassword) {
            if (errorEl) {
                errorEl.innerText = "Passwords do not match.";
                errorEl.classList.remove('hidden');
            }
            return;
        }

        const nameEl = document.getElementById('reg-name');
        const name = nameEl ? nameEl.value.trim() : "User";
        let payload = { role: currentRole, password: password, name: name };

        if (currentRole === 'employee') {
            payload.staff_id = username;
        } else {
            const isEmail = username.includes('@');
            if(isEmail) payload.email = username;
            else payload.phone = username;
        }
        
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Registration failed');
            }
            // Auto login after signup
            await window.performLogin(username, password);
        } catch (err) {
            if (errorEl) {
                errorEl.innerText = err.message;
                errorEl.classList.remove('hidden');
            }
        }
    } else {
        // Login flow
        try {
            await window.performLogin(username, password);
        } catch (err) {
            if (errorEl) {
                errorEl.innerText = err.message;
                errorEl.classList.remove('hidden');
            }
        }
    }
};
/* ==========================================
   ADMIN ACTIONS
   ========================================== */

async function handleCreateDoctor(event) {
    event.preventDefault();
    const name = document.getElementById('new-doc-name').value;
    const spec = document.getElementById('new-doc-spec').value;
    const degree = document.getElementById('new-doc-degree').value;
    const schedule = document.getElementById('new-doc-schedule').value;
    
    try {
        const res = await fetch('/api/admin/doctors', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + sessionStorage.getItem('hindalco_token')
            },
            body: JSON.stringify({
                name, specialization: spec, degree, availability_schedule: schedule, is_available: true
            })
        });
        if (res.ok) {
            alert("Doctor created successfully!");
            event.target.reset();
        } else {
            alert("Failed to create doctor.");
        }
    } catch (e) {
        console.error(e);
    }
}

async function handleFundWallet(event) {
    event.preventDefault();
    const userId = parseInt(document.getElementById('fund-user-id').value);
    const amount = parseFloat(document.getElementById('fund-amount').value);
    
    try {
        const res = await fetch('/api/admin/wallet/fund', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + sessionStorage.getItem('hindalco_token')
            },
            body: JSON.stringify({ user_id: userId, amount })
        });
        if (res.ok) {
            const data = await res.json();
            alert(`Wallet funded! New balance: ${data.new_balance}`);
            event.target.reset();
        } else {
            alert("Failed to fund wallet.");
        }
    } catch (e) {
        console.error(e);
    }
}
