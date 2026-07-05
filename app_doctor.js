
async function fetchDoctorData() {
    try {
        const res = await fetch('/api/admin/appointments', {
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('hindalco_token') }
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
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('hindalco_token') }
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
                'Authorization': 'Bearer ' + localStorage.getItem('hindalco_token')
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
