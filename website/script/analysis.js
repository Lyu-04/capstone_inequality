// Store user answers
const answers = {
  neighbourhood: null,
  soloOrCompare: null,
  domains: [],
  incomeGroup: 40000
};

let currentStep = 1;
const totalSteps = 4;

// Navigation functions
function nextStep() {
  if (!validateCurrentStep()) {
    showError(currentStep);
    return;
  }
  
  hideError(currentStep);
  if (currentStep < totalSteps) {
    currentStep++;
    updateUI();
  } else if (currentStep === totalSteps) {
    // Submit and go to report
    submitAnswers();
  }
}

function previousStep() {
  if (currentStep > 1) {
    hideError(currentStep);
    currentStep--;
    updateUI();
  }
}

// Validate current step
function validateCurrentStep() {
  switch(currentStep) {
    case 1:
      return answers.neighbourhood !== null;
    case 2:
      return answers.soloOrCompare !== null;
    case 3:
      return answers.domains.length > 0;
    case 4:
      return true; // Income slider always has a value
    default:
      return false;
  }
}

// Show/hide errors
function showError(step) {
  const errorEl = document.getElementById(`error-${step}`);
  if (errorEl) errorEl.classList.add('show');
}

function hideError(step) {
  const errorEl = document.getElementById(`error-${step}`);
  if (errorEl) errorEl.classList.remove('show');
}

// Select options
function selectOption(step, value) {
  // Remove previous selection styling
  const buttons = document.querySelectorAll(`#step-${step} .option-button`);
  buttons.forEach(btn => btn.classList.remove('selected'));
  
  // Add selection to clicked button
  event.target.classList.add('selected');
  
  // Store answer
  if (step === 1) {
    answers.neighbourhood = value;
  } else if (step === 2) {
    answers.soloOrCompare = value;
  }
  
  hideError(step);
}

// Select domains (multi-select)
function selectDomain(domain) {
  const index = answers.domains.indexOf(domain);
  if (index > -1) {
    answers.domains.splice(index, 1);
  } else {
    answers.domains.push(domain);
  }
  
  // Update checkbox styling
  const checkboxes = document.querySelectorAll('#step-3 .checkbox-item input');
  checkboxes.forEach(checkbox => {
    const label = checkbox.closest('.checkbox-item');
    if (checkbox.checked && answers.domains.includes(checkbox.value)) {
      label.classList.add('checked');
    } else if (!checkbox.checked) {
      label.classList.remove('checked');
    }
  });
  
  hideError(3);
}

// Update income display
function updateIncomeDisplay() {
  const slider = document.getElementById('incomeSlider');
  answers.incomeGroup = parseInt(slider.value);
  
  const formatter = new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0
  });
  
  document.getElementById('incomeValue').textContent = formatter.format(answers.incomeGroup);
}

// Update UI based on current step
function updateUI() {
  // Hide all steps
  document.querySelectorAll('.question-step').forEach(step => {
    step.classList.remove('active');
  });
  
  // Show current step
  document.getElementById(`step-${currentStep}`).classList.add('active');
  
  // Update progress bar
  const progressPercent = (currentStep / totalSteps) * 100;
  document.getElementById('progressFill').style.width = progressPercent + '%';
  document.getElementById('progressText').textContent = `Question ${currentStep} of ${totalSteps}`;
  
  // Update buttons
  const backBtn = document.getElementById('backBtn');
  const nextBtn = document.getElementById('nextBtn');
  
  if (currentStep === 1) {
    backBtn.style.display = 'none';
    nextBtn.textContent = 'Next →';
  } else if (currentStep === totalSteps) {
    backBtn.style.display = 'block';
    nextBtn.textContent = 'Generate Report';
  } else {
    backBtn.style.display = 'block';
    nextBtn.textContent = 'Next →';
  }
}

// Submit answers and go to report
function submitAnswers() {
  // Store answers in sessionStorage for report page
  sessionStorage.setItem('analysisAnswers', JSON.stringify(answers));
  
  // Redirect to report
  window.location.href = 'report.html';
}

// Populate report page
function populateReport() {
  const answersJson = sessionStorage.getItem('analysisAnswers');
  if (!answersJson) {
    document.getElementById('reportTitle').textContent = 'No Data';
    return;
  }
  
  const answers = JSON.parse(answersJson);
  
  // Set title
  document.getElementById('reportTitle').textContent = `Report: ${answers.neighbourhood}`;
  
  // Populate summary
  const summaryGrid = document.getElementById('summaryGrid');
  if (summaryGrid) {
    const formatter = new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0
    });
    
    summaryGrid.innerHTML = `
      <div class="summary-item">
        <div class="summary-label">Neighbourhood</div>
        <div class="summary-value">${answers.neighbourhood}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">View Type</div>
        <div class="summary-value">${answers.soloOrCompare}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Domains</div>
        <div class="summary-value">${answers.domains.join(', ')}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Income Group</div>
        <div class="summary-value">${formatter.format(answers.incomeGroup)}</div>
      </div>
    `;
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', function() {
  // Check if we're on the report page
  if (document.getElementById('reportTitle')) {
    populateReport();
  } else {
    // We're on the analysis page
    updateUI();
  }
});