// Override the fetchAndRenderLabReports to add a real PDF download button
window.fetchAndRenderLabReports = async function(isEmployee) {
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
                        ${r.status.toLowerCase() === 'completed' ? `<button class="submit-btn blue-btn btn-sm" onclick="downloadLabReportPDF(${r.id})" style="padding: 6px 12px; font-size: 0.75rem; width: auto; margin:0;">Download PDF</button>` : ''}
                    </div>
                </td>
            </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4">Error loading reports.</td></tr>';
    }
};

window.downloadLabReportPDF = async function(reportId) {
    showToast("Generating PDF...", currentRole);
    try {
        const token = localStorage.getItem('hindalco_token');
        const res = await fetch(`/api/lab_reports/${reportId}/pdf`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!res.ok) throw new Error("Failed to generate PDF");
        
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `LabReport_${reportId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        showToast("Download Complete", currentRole);
    } catch(e) {
        alert(e.message);
    }
};

window.fetchAndRenderPrescriptions = async function(isEmployee) {
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
                <td>
                    <button class="submit-btn btn-sm" onclick="downloadPrescriptionPDF(${p.id})" style="padding: 4px 8px; margin: 0; width: auto; font-size: 0.75rem;">Download Rx</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4">Error loading prescriptions.</td></tr>';
    }
};

window.downloadPrescriptionPDF = async function(prescId) {
    showToast("Generating Prescription PDF...", currentRole);
    try {
        const token = localStorage.getItem('hindalco_token');
        const res = await fetch(`/api/prescriptions/${prescId}/pdf`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!res.ok) throw new Error("Failed to generate PDF");
        
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `Prescription_${prescId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        showToast("Download Complete", currentRole);
    } catch(e) {
        alert(e.message);
    }
};
