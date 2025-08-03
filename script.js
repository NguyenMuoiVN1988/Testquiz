// Fallback configuration if config.js fails to load
if (typeof SUPABASE_CONFIG === 'undefined') {
    window.SUPABASE_CONFIG = {
        URL: 'https://xvcdjxhrhklibpjeizmt.supabase.co',
        ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2Y2RqeGhyaGtsaWJwamVpem10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMTQxNDgsImV4cCI6MjA2OTU5MDE0OH0.kT76MmN1aBFQub08Zpq-7t7V0X0iFldS8OAulHc0Cj4'
    };
}

if (typeof EXAM_CONFIG === 'undefined') {
    window.EXAM_CONFIG = {
        TIME_LIMIT: 3600, // 60 minutes in seconds
        MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
        ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain']
    };
}

// Supabase Configuration
const supabase = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);

// Global variables
let currentStudent = null;
let examTimer = null;
let timeLeft = EXAM_CONFIG.TIME_LIMIT; // Use config value
let uploadedFiles = {}; // Store uploaded file URLs

// DOM Elements
const loginForm = document.getElementById('loginForm');
const examForm = document.getElementById('examForm');
const loginError = document.getElementById('loginError');
const studentName = document.getElementById('studentName');
const timer = document.getElementById('timer');
const logoutBtn = document.getElementById('logoutBtn');
const resultModal = document.getElementById('resultModal');
const resultContent = document.getElementById('resultContent');
const closeModal = document.getElementById('closeModal');

// Event Listeners
document.getElementById('login').addEventListener('submit', handleLogin);
document.getElementById('exam').addEventListener('submit', handleExamSubmit);
logoutBtn.addEventListener('click', handleLogout);
closeModal.addEventListener('click', () => {
    resultModal.style.display = 'none';
});

// File upload event listeners
document.querySelectorAll('.file-input').forEach(input => {
    input.addEventListener('change', handleFileUpload);
});

// Login Handler
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        // Check if student exists in database
        const { data: students, error } = await supabase
            .from('students')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .single();
        
        if (error || !students) {
            loginError.textContent = 'Email hoặc mật khẩu không đúng!';
            return;
        }
        
        // Check if student has already taken the exam
        const { data: existingExam } = await supabase
            .from('exam_results')
            .select('*')
            .eq('student_id', students.id)
            .single();
        
        if (existingExam) {
            loginError.textContent = 'Bạn đã làm bài kiểm tra này rồi!';
            return;
        }
        
        // Login successful
        currentStudent = students;
        showExamForm();
        startTimer();
        
    } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = 'Có lỗi xảy ra, vui lòng thử lại!';
    }
}

// Show Exam Form
function showExamForm() {
    loginForm.style.display = 'none';
    examForm.style.display = 'block';
    studentName.textContent = currentStudent.name;
    
    // Trigger MathJax to render mathematical formulas
    if (window.MathJax) {
        window.MathJax.typesetPromise && window.MathJax.typesetPromise();
    }
}

// Timer Function
function startTimer() {
    examTimer = setInterval(() => {
        timeLeft--;
        
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(examTimer);
            alert('Hết thời gian làm bài!');
            handleExamSubmit(new Event('submit'));
        }
        
        // Warning when 5 minutes left
        if (timeLeft === 300) {
            alert('Còn 5 phút nữa!');
        }
    }, 1000);
}

// Handle File Upload
async function handleFileUpload(e) {
    const file = e.target.files[0];
    const questionNumber = e.target.name.replace('_file', '');
    const previewDiv = document.getElementById(`${questionNumber}_preview`);
    
    if (!file) return;
    
    // Validate file type - hỗ trợ cả JPG và JPEG
    const allowedTypes = [
        'application/pdf',
        'image/jpeg',  // Cả JPG và JPEG đều có MIME type này
        'image/jpg',   // Một số browser dùng type này
        'image/png'
    ];
    
    // Kiểm tra cả MIME type và file extension
    const isValidType = allowedTypes.includes(file.type) || 
                       file.name.toLowerCase().endsWith('.pdf') ||
                       file.name.toLowerCase().endsWith('.jpg') ||
                       file.name.toLowerCase().endsWith('.jpeg') ||
                       file.name.toLowerCase().endsWith('.png');
    
    if (!isValidType) {
        alert('Vui lòng chọn file PDF hoặc ảnh (JPG, JPEG, PNG)!');
        return;
    }
    
    // Validate file size (max 10MB for PDF, 5MB for images)
    const maxSize = file.type === 'application/pdf' ? 10 * 1024 * 1024 : EXAM_CONFIG.MAX_FILE_SIZE;
    if (file.size > maxSize) {
        const maxSizeMB = maxSize / (1024 * 1024);
        alert(`File quá lớn! Vui lòng chọn file nhỏ hơn ${maxSizeMB}MB.`);
        return;
    }
    
    try {
        // Show loading state
        previewDiv.innerHTML = '<div class="loading"></div> Đang tải file...';
        previewDiv.style.display = 'block';
        
        // Generate unique filename with proper extension
        const timestamp = Date.now();
        let fileExtension = '';
        
        // Xác định extension dựa trên MIME type hoặc tên file
        if (file.type === 'application/pdf') {
            fileExtension = 'pdf';
        } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
            // Sử dụng extension từ tên file gốc hoặc mặc định là jpg
            const originalExt = file.name.split('.').pop().toLowerCase();
            fileExtension = (originalExt === 'jpeg' || originalExt === 'jpg') ? originalExt : 'jpg';
        } else if (file.type === 'image/png') {
            fileExtension = 'png';
        }
        
        const fileName = `exam_${currentStudent.id}_q${questionNumber}_${timestamp}.${fileExtension}`;
        
        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('exam-files')
            .upload(fileName, file);
        
        if (error) {
            throw error;
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('exam-files')
            .getPublicUrl(fileName);
        
        // Store file info
        uploadedFiles[questionNumber] = {
            url: publicUrl,
            name: file.name,
            size: file.size,
            type: file.type
        };
        
        // Show file preview
        showFilePreview(previewDiv, uploadedFiles[questionNumber], questionNumber);
        
    } catch (error) {
        console.error('Upload error:', error);
        previewDiv.innerHTML = '<div class="error-message">Lỗi upload file. Vui lòng thử lại!</div>';
    }
}

// Show File Preview
function showFilePreview(previewDiv, fileInfo, questionNumber) {
    const isImage = fileInfo.type.startsWith('image/');
    const isPDF = fileInfo.type === 'application/pdf';
    
    let previewHTML = '';
    
    if (isImage) {
        previewHTML = `
            <div class="file-preview-item">
                <img src="${fileInfo.url}" alt="Preview" style="max-width: 200px; max-height: 200px;">
                <div class="file-info">
                    <p><strong>${fileInfo.name}</strong></p>
                    <p>Kích thước: ${formatFileSize(fileInfo.size)}</p>
                </div>
                <button class="remove-btn" onclick="removeFile('${questionNumber}')">❌ Xóa</button>
                <button class="view-btn" onclick="openFileModal('${fileInfo.url}', '${fileInfo.name}')">👁️ Xem</button>
            </div>
        `;
    } else if (isPDF) {
        previewHTML = `
            <div class="file-preview-item">
                <div class="pdf-preview">
                    <div class="pdf-icon">📄</div>
                    <div class="pdf-name">${fileInfo.name}</div>
                    <div class="pdf-size">${formatFileSize(fileInfo.size)}</div>
                </div>
                <button class="remove-btn" onclick="removeFile('${questionNumber}')">❌ Xóa</button>
                <button class="view-btn" onclick="openFileModal('${fileInfo.url}', '${fileInfo.name}')">👁️ Xem</button>
            </div>
        `;
    }
    
    previewDiv.innerHTML = previewHTML;
}

// Remove File
function removeFile(questionNumber) {
    delete uploadedFiles[questionNumber];
    const previewDiv = document.getElementById(`${questionNumber}_preview`);
    previewDiv.innerHTML = '';
    previewDiv.style.display = 'none';
    
    // Reset file input
    const fileInput = document.querySelector(`input[name="${questionNumber}_file"]`);
    if (fileInput) {
        fileInput.value = '';
    }
}

// Open File Modal
function openFileModal(fileUrl, fileName) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 10px; max-width: 90%; max-height: 90%; overflow: auto;">
            <h3>${fileName}</h3>
            <iframe src="${fileUrl}" width="100%" height="500px" style="border: none;"></iframe>
            <button onclick="this.parentElement.parentElement.remove()" style="margin-top: 10px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Đóng</button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Format File Size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Handle Exam Submit
async function handleExamSubmit(e) {
    e.preventDefault();
    
    if (examTimer) {
        clearInterval(examTimer);
    }
    
    // Collect answers
    const formData = new FormData(e.target);
    const answers = {};
    
    for (let i = 1; i <= 6; i++) {
        answers[`q${i}`] = formData.get(`q${i}`) || '';
    }
    
    try {
        // Save exam results to database
        const { data, error } = await supabase
            .from('exam_results')
            .insert([
                {
                    student_id: currentStudent.id,
                    student_name: currentStudent.name,
                    answers: answers,
                    uploaded_files: uploadedFiles,
                    time_taken: EXAM_CONFIG.TIME_LIMIT - timeLeft,
                    submitted_at: new Date().toISOString()
                }
            ]);
        
        if (error) {
            throw error;
        }
        
        // Show results
        showResults({ answers, uploadedFiles });
        
    } catch (error) {
        console.error('Submit error:', error);
        alert('Có lỗi xảy ra khi nộp bài. Vui lòng thử lại!');
    }
}

// Show Results
function showResults(answersWithFiles) {
    let resultHTML = '<h3>Bài làm của bạn đã được nộp thành công!</h3>';
    
    // Show answers
    Object.keys(answersWithFiles.answers).forEach(question => {
        const answer = answersWithFiles.answers[question];
        const files = answersWithFiles.uploadedFiles[question];
        
        resultHTML += `
            <p><strong>${question.toUpperCase()}:</strong></p>
            <p>${answer || 'Không có câu trả lời'}</p>
        `;
        
        if (files) {
            resultHTML += `<p><strong>File đính kèm:</strong> <a href="${files.url}" target="_blank">${files.name}</a></p>`;
        }
        
        resultHTML += '<hr>';
    });
    
    resultContent.innerHTML = resultHTML;
    resultModal.style.display = 'block';
}

// Handle Logout
function handleLogout() {
    if (examTimer) {
        clearInterval(examTimer);
    }
    
    currentStudent = null;
    timeLeft = EXAM_CONFIG.TIME_LIMIT;
    uploadedFiles = {};
    
    loginForm.style.display = 'flex';
    examForm.style.display = 'none';
    
    // Reset forms
    document.getElementById('login').reset();
    document.getElementById('exam').reset();
    
    // Clear file previews
    document.querySelectorAll('.file-preview').forEach(preview => {
        preview.innerHTML = '';
        preview.style.display = 'none';
    });
    
    // Reset timer
    timer.textContent = '60:00';
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Exam system initialized successfully');
});
