// Smart Waste Segregation System - JavaScript Application

class WasteSegregationApp {
    constructor() {
        this.currentUser = null;
        this.isRecording = false;
        this.recordingTimer = null;
        this.scanner = null;
        this.currentStream = null;
        
        // Sample data from the provided JSON
        this.wasteCategories = [
            {"name": "Dry Waste", "examples": ["paper", "cardboard", "plastic bottles", "cans"], "color": "#8B4513"},
            {"name": "Wet Waste", "examples": ["food scraps", "vegetable peels", "fruit waste"], "color": "#228B22"},
            {"name": "Domestic Hazardous Waste", "examples": ["batteries", "electronics", "chemicals", "medicines"], "color": "#FF4500"}
        ];
        
        this.sampleDetections = [
            {"item": "plastic bottle", "category": "Dry Waste", "confidence": 0.95},
            {"item": "banana peel", "category": "Wet Waste", "confidence": 0.87},
            {"item": "battery", "category": "Domestic Hazardous Waste", "confidence": 0.92},
            {"item": "paper", "category": "Dry Waste", "confidence": 0.89},
            {"item": "apple core", "category": "Wet Waste", "confidence": 0.83},
            {"item": "aluminum can", "category": "Dry Waste", "confidence": 0.91},
            {"item": "expired medicine", "category": "Domestic Hazardous Waste", "confidence": 0.88},
            {"item": "food container", "category": "Wet Waste", "confidence": 0.79}
        ];
        
        this.rewardSystem = {
            "correct_segregation_reward": 10,
            "incorrect_segregation_fine": 5,
            "currency": "points"
        };
        
        this.init();
    }
    
    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupApplication();
            });
        } else {
            this.setupApplication();
        }
    }
    
    setupApplication() {
        this.setupNavigation();
        this.setupEventListeners();
        this.loadStoredData();
        this.updateStatistics();
        this.showPage('home');
        this.showToast('Welcome to Smart Waste Segregation System!', 'success');
    }
    
    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            // Remove any existing listeners
            link.removeEventListener('click', this.handleNavClick);
            
            // Add new listener with proper binding
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const page = e.target.getAttribute('data-page');
                this.showPage(page);
                this.setActiveNavLink(e.target);
            });
        });
    }
    
    showPage(pageId) {
        console.log('Showing page:', pageId);
        
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        // Show selected page
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
        }
        
        // Update nav active state
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-page') === pageId) {
                link.classList.add('active');
            }
        });
        
        // Page-specific initialization
        if (pageId === 'results') {
            this.loadResults();
        } else if (pageId === 'settings') {
            this.loadAWSSettings();
        }
    }
    
    setActiveNavLink(activeLink) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        activeLink.classList.add('active');
    }
    
    setupEventListeners() {
        // User registration form
        const userForm = document.getElementById('user-form');
        if (userForm) {
            userForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleUserRegistration(e);
            });
        }
        
        // QR Scanner
        const startScannerBtn = document.getElementById('start-scanner');
        const stopScannerBtn = document.getElementById('stop-scanner');
        const manualSubmitBtn = document.getElementById('manual-submit');
        
        if (startScannerBtn) {
            startScannerBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.startQRScanner();
            });
        }
        if (stopScannerBtn) {
            stopScannerBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.stopQRScanner();
            });
        }
        if (manualSubmitBtn) {
            manualSubmitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleManualUserInput();
            });
        }
        
        // Recording
        const startRecordingBtn = document.getElementById('start-recording');
        if (startRecordingBtn) {
            startRecordingBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.startRecording();
            });
        }
        
        // Settings
        const awsSettingsForm = document.getElementById('aws-settings-form');
        const testConnectionBtn = document.getElementById('test-connection');
        
        if (awsSettingsForm) {
            awsSettingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveAWSSettings(e);
            });
        }
        if (testConnectionBtn) {
            testConnectionBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.testAWSConnection();
            });
        }
        
        // Results export
        const exportCsvBtn = document.getElementById('export-csv');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.exportResultsCSV();
            });
        }
        
        // Download QR
        const downloadQrBtn = document.getElementById('download-qr');
        if (downloadQrBtn) {
            downloadQrBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.downloadQRCode();
            });
        }
    }
    
    // User Registration
    async handleUserRegistration(e) {
        e.preventDefault();
        console.log('Handling user registration');

        const userForm = e.target;
        const formData = new FormData(userForm);
        const userData = Object.fromEntries(formData.entries());

        if (!userData.name || !userData.phone || !userData.email || !userData.address) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        try {
            const response = await fetch('/api/generate-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.showToast('User registered successfully!', 'success');
                this.generateQRCode(result.user_data, result.qr_code_url);
                userForm.reset();
                this.updateStatistics(); // Refresh stats from backend
            } else {
                this.showToast(`Error: ${result.message}`, 'error');
            }
        } catch (error) {
            console.error('Failed to register user:', error);
            this.showToast('Failed to connect to the server.', 'error');
        }
    }
    
    generateQRCode(userData, qrCodeUrl) {
        console.log('Displaying QR code for:', userData);
        
        const qrContainer = document.getElementById('qr-code-container');
        const userDetailsDiv = document.getElementById('user-details');
        const qrResultDiv = document.getElementById('qr-result');
        
        // Display the QR code image from the server
        qrContainer.innerHTML = '';
        const qrImage = document.createElement('img');
        qrImage.src = qrCodeUrl;
        qrImage.alt = `QR Code for ${userData.name}`;
        qrImage.style.width = '200px';
        qrImage.style.height = '200px';
        qrContainer.appendChild(qrImage);
        
        // Display user details
        userDetailsDiv.innerHTML = `
            <div class="user-detail-item">
                <span class="user-detail-label">User ID:</span>
                <span class="user-detail-value">${userData.id || 'N/A'}</span>
            </div>
            <div class="user-detail-item">
                <span class="user-detail-label">Name:</span>
                <span class="user-detail-value">${userData.name}</span>
            </div>
            <div class="user-detail-item">
                <span class="user-detail-label">Phone:</span>
                <span class="user-detail-value">${userData.phone}</span>
            </div>
            <div class="user-detail-item">
                <span class="user-detail-label">Email:</span>
                <span class="user-detail-value">${userData.email}</span>
            </div>
        `;
        
        // Show result section
        qrResultDiv.classList.remove('hidden');
    }
    
    downloadQRCode() {
        const qrImage = document.querySelector('#qr-code-container img');
        if (qrImage) {
            const link = document.createElement('a');
            link.download = `user-qr-${Date.now()}.png`;
            link.href = qrImage.src;
            link.click();
            this.showToast('QR Code downloaded!', 'success');
        } else {
            this.showToast('No QR code to download', 'warning');
        }
    }
    
    // QR Scanner
    async startQRScanner() {
        console.log('Starting QR scanner');
        
        try {
            const video = document.getElementById('qr-video');
            const startBtn = document.getElementById('start-scanner');
            const stopBtn = document.getElementById('stop-scanner');
            
            startBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
            
            // Try to access camera
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'environment' } 
                });
                video.srcObject = stream;
                this.currentStream = stream;
                
                this.showToast('Camera started. Point at QR code or use manual input.', 'info');
                
                // Start scanning simulation
                this.simulateQRScanning();
                
            } catch (cameraError) {
                console.log('Camera not available:', cameraError);
                this.showToast('Camera access denied. Use manual input below.', 'warning');
                this.simulateQRScanning();
            }
            
        } catch (error) {
            console.error('Scanner error:', error);
            this.showToast('Scanner error. Please use manual input.', 'error');
        }
    }
    
    simulateQRScanning() {
        // Simulate QR scanning after 3 seconds for demo purposes
        setTimeout(() => {
            const users = JSON.parse(localStorage.getItem('waste_users') || '[]');
            if (users.length > 0) {
                const randomUser = users[Math.floor(Math.random() * users.length)];
                this.handleQRScanResult(randomUser.id);
                this.showToast(`QR Code detected: ${randomUser.name}`, 'success');
            } else {
                this.showToast('No users found. Please register a user first.', 'warning');
            }
        }, 3000);
    }
    
    stopQRScanner() {
        console.log('Stopping QR scanner');
        
        const startBtn = document.getElementById('start-scanner');
        const stopBtn = document.getElementById('stop-scanner');
        
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }
        
        const video = document.getElementById('qr-video');
        video.srcObject = null;
        
        startBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        
        this.showToast('Scanner stopped', 'info');
    }
    
    handleManualUserInput() {
        console.log('Handling manual user input');
        
        const userIdInput = document.getElementById('manual-user-id');
        const userId = userIdInput.value.trim();
        
        if (!userId) {
            this.showToast('Please enter a User ID', 'error');
            return;
        }
        
        this.handleQRScanResult(userId);
        userIdInput.value = '';
    }
    
    handleQRScanResult(userId) {
        console.log('Handling QR scan result for:', userId);
        
        const users = JSON.parse(localStorage.getItem('waste_users') || '[]');
        const user = users.find(u => u.id === userId);
        
        if (user) {
            this.currentUser = user;
            this.displayUserInfo(user);
            this.stopQRScanner();
        } else {
            this.showToast('User not found. Please check the User ID.', 'error');
        }
    }
    
    displayUserInfo(user) {
        console.log('Displaying user info for:', user);
        
        const userInfoDiv = document.getElementById('user-info');
        const userDetailsDisplay = document.getElementById('user-details-display');
        
        userDetailsDisplay.innerHTML = `
            <div class="user-detail-item">
                <span class="user-detail-label">User ID:</span>
                <span class="user-detail-value">${user.id}</span>
            </div>
            <div class="user-detail-item">
                <span class="user-detail-label">Name:</span>
                <span class="user-detail-value">${user.name}</span>
            </div>
            <div class="user-detail-item">
                <span class="user-detail-label">Phone:</span>
                <span class="user-detail-value">${user.phone}</span>
            </div>
        `;
        
        userInfoDiv.classList.remove('hidden');
    }
    
    // Video Recording
    async startRecording() {
        console.log('Starting recording');
        
        if (!this.currentUser) {
            this.showToast('No user selected', 'error');
            return;
        }
        
        this.isRecording = true;
        const recordingSection = document.getElementById('recording-section');
        const userInfoDiv = document.getElementById('user-info');
        
        recordingSection.classList.remove('hidden');
        userInfoDiv.classList.add('hidden');
        
        this.showToast('Starting 90-second recording...', 'info');
        
        // Simulate video recording
        await this.simulateVideoRecording();
        
        // Process the recording
        this.processRecording();
    }
    
    async simulateVideoRecording() {
        console.log('Simulating video recording');
        
        return new Promise((resolve) => {
            const timerElement = document.getElementById('recording-timer');
            const progressElement = document.getElementById('recording-progress');
            let timeLeft = 90;
            
            // Try to get camera access for real video
            navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                .then(stream => {
                    const video = document.getElementById('recording-video');
                    video.srcObject = stream;
                    video.play();
                    this.currentStream = stream;
                })
                .catch(() => {
                    // Fallback to placeholder if camera not available
                    const video = document.getElementById('recording-video');
                    video.style.background = 'linear-gradient(45deg, #f0f0f0, #e0e0e0)';
                    video.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">📹 Recording Simulation</div>';
                });
            
            this.recordingTimer = setInterval(() => {
                timeLeft--;
                timerElement.textContent = timeLeft;
                
                const progress = ((90 - timeLeft) / 90) * 100;
                progressElement.style.width = `${progress}%`;
                
                if (timeLeft <= 0) {
                    clearInterval(this.recordingTimer);
                    this.isRecording = false;
                    
                    // Stop camera stream
                    if (this.currentStream) {
                        this.currentStream.getTracks().forEach(track => track.stop());
                    }
                    
                    this.showToast('Recording completed!', 'success');
                    resolve();
                }
            }, 100); // Faster for demo - use 1000 for real seconds
        });
    }
    
    async processRecording() {
        console.log('Processing recording');
        
        const recordingSection = document.getElementById('recording-section');
        const processingSection = document.getElementById('processing-section');
        
        recordingSection.classList.add('hidden');
        processingSection.classList.remove('hidden');
        
        // Simulate processing steps
        await this.simulateProcessingStep('step-frames', 'Extracting frames...', 2000);
        await this.simulateProcessingStep('step-analysis', 'Analyzing with AWS Rekognition...', 3000);
        await this.simulateProcessingStep('step-classification', 'Classifying waste items...', 2000);
        
        // Generate results
        this.generateResults();
    }
    
    async simulateProcessingStep(stepId, message, duration) {
        return new Promise((resolve) => {
            const stepElement = document.getElementById(stepId);
            const statusElement = stepElement.querySelector('.step-status');
            
            stepElement.classList.add('processing');
            statusElement.textContent = '⏳';
            
            setTimeout(() => {
                stepElement.classList.remove('processing');
                stepElement.classList.add('completed');
                statusElement.textContent = '✅';
                resolve();
            }, duration);
        });
    }
    
    generateResults() {
        console.log('Generating results');
        
        // Simulate AWS Rekognition detection results
        const numDetections = Math.floor(Math.random() * 3) + 1; // 1-3 items
        const detectedItems = [];
        
        for (let i = 0; i < numDetections; i++) {
            const randomDetection = this.sampleDetections[Math.floor(Math.random() * this.sampleDetections.length)];
            detectedItems.push({
                ...randomDetection,
                confidence: Math.random() * 0.3 + 0.7 // 0.7-1.0 confidence
            });
        }
        
        // Simulate correctness evaluation (70% chance of correct segregation)
        const isCorrect = Math.random() > 0.3;
        const points = isCorrect ? this.rewardSystem.correct_segregation_reward : -this.rewardSystem.incorrect_segregation_fine;
        
        // Store result
        const result = {
            id: this.generateResultId(),
            userId: this.currentUser.id,
            userName: this.currentUser.name,
            timestamp: new Date().toISOString(),
            detectedItems: detectedItems,
            isCorrect: isCorrect,
            points: points
        };
        
        this.saveResult(result);
        this.displayResult(result);
        
        this.showToast('Processing complete! View results below.', 'success');
        
        // Navigate to results page after a short delay
        setTimeout(() => {
            this.showPage('results');
            this.resetScanningProcess();
        }, 3000);
    }
    
    generateResultId() {
        return `RES${Date.now()}${Math.random().toString(36).substr(2, 5)}`.toUpperCase();
    }
    
    saveResult(result) {
        let results = JSON.parse(localStorage.getItem('waste_results') || '[]');
        results.unshift(result); // Add to beginning
        localStorage.setItem('waste_results', JSON.stringify(results));
        this.updateStatistics();
    }
    
    displayResult(result) {
        console.log('Displaying result:', result);
        
        const currentResultDiv = document.getElementById('current-result');
        const detectionResultsDiv = document.getElementById('detection-results');
        const evaluationResultDiv = document.getElementById('evaluation-result');
        
        // Display detected items
        detectionResultsDiv.innerHTML = result.detectedItems.map(item => {
            const categoryClass = item.category.toLowerCase().replace(/\s+/g, '-');
            return `
                <div class="detection-item ${categoryClass}">
                    <div class="detection-info">
                        <div class="detection-name">${item.item}</div>
                        <div class="detection-category">${item.category}</div>
                    </div>
                    <div class="detection-confidence">${(item.confidence * 100).toFixed(1)}%</div>
                </div>
            `;
        }).join('');
        
        // Display evaluation
        const evaluationClass = result.isCorrect ? 'correct' : 'incorrect';
        const evaluationMessage = result.isCorrect 
            ? `✅ Correct Segregation! +${result.points} points awarded`
            : `❌ Incorrect Segregation! ${result.points} points deducted`;
        
        evaluationResultDiv.className = evaluationClass;
        evaluationResultDiv.textContent = evaluationMessage;
        
        currentResultDiv.classList.remove('hidden');
    }
    
    resetScanningProcess() {
        console.log('Resetting scanning process');
        
        // Hide all sections
        document.getElementById('user-info')?.classList.add('hidden');
        document.getElementById('recording-section')?.classList.add('hidden');
        document.getElementById('processing-section')?.classList.add('hidden');
        
        // Reset scanner
        const startBtn = document.getElementById('start-scanner');
        const stopBtn = document.getElementById('stop-scanner');
        if (startBtn && stopBtn) {
            startBtn.classList.remove('hidden');
            stopBtn.classList.add('hidden');
        }
        
        // Clear current user
        this.currentUser = null;
        
        // Reset processing steps
        document.querySelectorAll('.processing-step').forEach(step => {
            step.classList.remove('processing', 'completed');
            const statusElement = step.querySelector('.step-status');
            if (statusElement) {
                statusElement.textContent = '⏳';
            }
        });
    }
    
    // Results Management
    loadResults() {
        console.log('Loading results');
        
        const results = JSON.parse(localStorage.getItem('waste_results') || '[]');
        const tbody = document.getElementById('results-tbody');
        
        if (!tbody) return;
        
        tbody.innerHTML = results.map(result => {
            const date = new Date(result.timestamp).toLocaleDateString();
            const itemsList = result.detectedItems.map(item => item.item).join(', ');
            const categories = [...new Set(result.detectedItems.map(item => item.category))].join(', ');
            const correctnessText = result.isCorrect ? '✅ Correct' : '❌ Incorrect';
            const pointsClass = result.points > 0 ? 'points-positive' : 'points-negative';
            const pointsText = result.points > 0 ? `+${result.points}` : result.points;
            
            return `
                <tr>
                    <td>${date}</td>
                    <td>${result.userName}</td>
                    <td>${itemsList}</td>
                    <td>${categories}</td>
                    <td>${correctnessText}</td>
                    <td class="${pointsClass}">${pointsText}</td>
                </tr>
            `;
        }).join('');
        
        if (results.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--color-text-secondary);">No results found</td></tr>';
        }
    }
    
    exportResultsCSV() {
        console.log('Exporting results to CSV');
        
        const results = JSON.parse(localStorage.getItem('waste_results') || '[]');
        
        if (results.length === 0) {
            this.showToast('No results to export', 'warning');
            return;
        }
        
        const csvHeaders = ['Date', 'User Name', 'User ID', 'Detected Items', 'Categories', 'Correctness', 'Points'];
        const csvRows = results.map(result => {
            const date = new Date(result.timestamp).toLocaleDateString();
            const itemsList = result.detectedItems.map(item => item.item).join('; ');
            const categories = [...new Set(result.detectedItems.map(item => item.category))].join('; ');
            const correctness = result.isCorrect ? 'Correct' : 'Incorrect';
            
            return [
                date,
                result.userName,
                result.userId,
                `"${itemsList}"`,
                `"${categories}"`,
                correctness,
                result.points
            ].join(',');
        });
        
        const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `waste-segregation-results-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        this.showToast('Results exported successfully', 'success');
    }
    
    // AWS Settings
    loadAWSSettings() {
        console.log('Loading AWS settings');
        
        const awsSettings = JSON.parse(localStorage.getItem('aws_settings') || '{}');
        
        if (awsSettings.accessKey) {
            document.getElementById('aws-access-key').value = awsSettings.accessKey;
        }
        if (awsSettings.secretKey) {
            document.getElementById('aws-secret-key').value = awsSettings.secretKey;
        }
        if (awsSettings.region) {
            document.getElementById('aws-region').value = awsSettings.region;
        }
        if (awsSettings.endpoint) {
            document.getElementById('rekognition-endpoint').value = awsSettings.endpoint;
        }
    }
    
    saveAWSSettings(e) {
        e.preventDefault();
        console.log('Saving AWS settings');
        
        const settings = {
            accessKey: document.getElementById('aws-access-key').value.trim(),
            secretKey: document.getElementById('aws-secret-key').value.trim(),
            region: document.getElementById('aws-region').value,
            endpoint: document.getElementById('rekognition-endpoint').value.trim()
        };
        
        if (!settings.accessKey || !settings.secretKey) {
            this.showToast('Please enter AWS Access Key and Secret Key', 'error');
            return;
        }
        
        localStorage.setItem('aws_settings', JSON.stringify(settings));
        this.showToast('AWS settings saved successfully', 'success');
    }
    
    testAWSConnection() {
        console.log('Testing AWS connection');
        
        const settings = JSON.parse(localStorage.getItem('aws_settings') || '{}');
        const statusDiv = document.getElementById('connection-status');
        const messageDiv = document.getElementById('status-message');
        
        if (!settings.accessKey || !settings.secretKey) {
            messageDiv.innerHTML = '<span class="status-error">❌ Please configure AWS credentials first</span>';
            statusDiv.classList.remove('hidden');
            return;
        }
        
        // Simulate connection test
        messageDiv.innerHTML = '<span>⏳ Testing connection...</span>';
        statusDiv.classList.remove('hidden');
        
        setTimeout(() => {
            // Simulate successful connection (in real app, make actual AWS API call)
            messageDiv.innerHTML = '<span class="status-success">✅ Connection successful! AWS Rekognition is ready.</span>';
            this.showToast('AWS connection test successful', 'success');
        }, 2000);
    }
    
    // Statistics
    updateStatistics() {
        const users = JSON.parse(localStorage.getItem('waste_users') || '[]');
        const results = JSON.parse(localStorage.getItem('waste_results') || '[]');
        
        const totalUsers = users.length;
        const correctSegregations = results.filter(r => r.isCorrect).length;
        const totalRewards = results.filter(r => r.points > 0).reduce((sum, r) => sum + r.points, 0);
        const totalFines = Math.abs(results.filter(r => r.points < 0).reduce((sum, r) => sum + r.points, 0));
        
        const totalUsersEl = document.getElementById('total-users');
        const correctSegregationsEl = document.getElementById('correct-segregations');
        const rewardsGivenEl = document.getElementById('rewards-given');
        const finesCollectedEl = document.getElementById('fines-collected');
        
        if (totalUsersEl) totalUsersEl.textContent = totalUsers;
        if (correctSegregationsEl) correctSegregationsEl.textContent = correctSegregations;
        if (rewardsGivenEl) rewardsGivenEl.textContent = totalRewards;
        if (finesCollectedEl) finesCollectedEl.textContent = totalFines;
    }
    
    // Utility Methods
    loadStoredData() {
        console.log('Loading stored data');
        // This method is called on initialization to load any saved data
        this.updateStatistics();
    }
    
    showToast(message, type = 'info') {
        console.log(`Toast: ${type} - ${message}`);
        
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        }[type] || 'ℹ️';
        
        toast.innerHTML = `
            <span>${icon}</span>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
        
        // Make toast clickable to dismiss
        toast.addEventListener('click', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app');
    window.wasteApp = new WasteSegregationApp();
});

// Also initialize if DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('DOM already loaded, initializing app');
    window.wasteApp = new WasteSegregationApp();
}