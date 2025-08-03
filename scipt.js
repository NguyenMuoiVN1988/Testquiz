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
        } else {
            // Fallback: lấy extension từ tên file
            fileExtension = file.name.split('.').pop().toLowerCase();
        }
        
        const fileName = `${currentStudent.id}_${questionNumber}_${timestamp}.${fileExtension}`;
        
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
        
        // Store the file info
        uploadedFiles[questionNumber] = {
            url: publicUrl,
            name: file.name,
            type: file.type,
            size: file.size,
            extension: fileExtension
        };
        
        // Show preview
        showFilePreview(previewDiv, uploadedFiles[questionNumber], questionNumber);
        
    } catch (error) {
        console.error('Upload error:', error);
        previewDiv.innerHTML = '<div class="error-message">Lỗi tải file! Vui lòng thử lại.</div>';
    }
}

// Show File Preview
function showFilePreview(previewDiv, fileInfo, questionNumber) {
    const isImage = fileInfo.type.startsWith('image/');
    const isPDF = fileInfo.type === 'application/pdf';
    const fileSize = formatFileSize(fileInfo.size);
    
    if (isImage) {
        previewDiv.innerHTML = `
            <img src="${fileInfo.url}" alt="Bài làm câu ${questionNumber}" />
            <button class="remove-btn" onclick="removeFile('${questionNumber}')">×</button>
            <div class="file-info">${fileInfo.name} - ${fileSize} (${fileInfo.extension.toUpperCase()})</div>
        `;
    } else if (isPDF) {
        previewDiv.innerHTML = `
            <div class="pdf-preview">
                <div class="pdf-icon">📄</div>
                <div class="pdf-name">${fileInfo.name}</div>
                <div class="pdf-size">${fileSize}</div>
                <button class="view-btn" onclick="openFileModal('${fileInfo.url}', '${fileInfo.name}')">👁️ Xem PDF</button>
                <button class="remove-btn" onclick="removeFile('${questionNumber}')">×</button>
            </div>
        `;
    }
    
    previewDiv.style.display = 'block';
}

// Remove File
function removeFile(questionNumber) {
    const previewDiv = document.getElementById(`${questionNumber}_preview`);
    const fileInput = document.querySelector(`input[name="${questionNumber}_file"]`);
    
    // Clear the file input
    fileInput.value = '';
    
    // Remove from uploaded files
    delete uploadedFiles[questionNumber];
    
    // Hide preview
    previewDiv.style.display = 'none';
    previewDiv.innerHTML = '';
}

// Open File Modal
function openFileModal(fileUrl, fileName) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content large">
            <div class="modal-header">
                <h2>Xem file: ${fileName}</h2>
                <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="modal-body">
                <iframe src="${fileUrl}" width="100%" height="600px" frameborder="0"></iframe>
            </div>
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

// Exam Submit Handler
async function handleExamSubmit(e) {
    e.preventDefault();
    
    if (examTimer) {
        clearInterval(examTimer);
    }
    
    const formData = new FormData(e.target);
    const answers = {
        q1: formData.get('q1') || '',
        q2: formData.get('q2') || '',
        q3: formData.get('q3') || '',
        q4: formData.get('q4') || '',
        q5: formData.get('q5') || '',
        q6: formData.get('q6') || ''
    };
    
    // Add file URLs to answers
    const answersWithFiles = {
        ...answers,
        files: uploadedFiles
    };
    
    try {
        // Save exam results to database
        const { data, error } = await supabase
            .from('exam_results')
            .insert([
                {
                    student_id: currentStudent.id,
                    student_name: currentStudent.name,
                    student_email: currentStudent.email,
                    answers: answersWithFiles,
                    time_taken: 3600 - timeLeft,
                    submitted_at: new Date().toISOString()
                }
            ]);
        
        if (error) {
            console.error('Error saving exam:', error);
            alert('Có lỗi xảy ra khi lưu bài làm!');
            return;
        }
        
        // Show results
        showResults(answersWithFiles);
        
    } catch (error) {
        console.error('Exam submit error:', error);
        alert('Có lỗi xảy ra!');
    }
}

// Show Results
function showResults(answersWithFiles) {
    const timeTaken = 3600 - timeLeft;
    const minutes = Math.floor(timeTaken / 60);
    const seconds = timeTaken % 60;
    
    let filesHtml = '';
    if (Object.keys(answersWithFiles.files || {}).length > 0) {
        filesHtml = '<h4>File bài làm:</h4>';
        Object.keys(answersWithFiles.files).forEach(qNum => {
            const fileInfo = answersWithFiles.files[qNum];
            const isPDF = fileInfo.type === 'application/pdf';
            const icon = isPDF ? '📄' : '🖼️';
            const extension = fileInfo.extension ? ` (${fileInfo.extension.toUpperCase()})` : '';
            filesHtml += `<p><strong>Câu ${qNum}:</strong> ${icon} <a href="${fileInfo.url}" target="_blank">${fileInfo.name}</a>${extension} - ${formatFileSize(fileInfo.size)}</p>`;
        });
    }
    
    resultContent.innerHTML = `
        <p><strong>Học sinh:</strong> ${currentStudent.name}</p>
        <p><strong>Email:</strong> ${currentStudent.email}</p>
        <p><strong>Thời gian làm bài:</strong> ${minutes}:${seconds.toString().padStart(2, '0')}</p>
        <p><strong>Trạng thái:</strong> <span style="color: #27ae60;">Đã nộp bài thành công!</span></p>
        <hr style="margin: 20px 0;">
        <h3>Đáp án của bạn:</h3>
        <p><strong>Câu 1:</strong> ${answersWithFiles.q1 || 'Chưa trả lời'}</p>
        <p><strong>Câu 2:</strong> ${answersWithFiles.q2 || 'Chưa trả lời'}</p>
        <p><strong>Câu 3:</strong> ${answersWithFiles.q3 || 'Chưa trả lời'}</p>
        <p><strong>Câu 4:</strong> ${answersWithFiles.q4 || 'Chưa trả lời'}</p>
        <p><strong>Câu 5:</strong> ${answersWithFiles.q5 || 'Chưa trả lời'}</p>
        <p><strong>Câu 6:</strong> ${answersWithFiles.q6 || 'Chưa trả lời'}</p>
        ${filesHtml}
    `;
    
    resultModal.style.display = 'flex';
}

// Logout Handler
function handleLogout() {
    if (examTimer) {
        clearInterval(examTimer);
    }
    
    currentStudent = null;
    timeLeft = 3600;
    timer.textContent = '60:00';
    uploadedFiles = {};
    
    // Reset form
    document.getElementById('exam').reset();
    
    // Clear file previews
    document.querySelectorAll('.file-preview').forEach(preview => {
        preview.style.display = 'none';
        preview.innerHTML = '';
    });
    
    // Show login form
    examForm.style.display = 'none';
    loginForm.style.display = 'flex';
    loginError.textContent = '';
    
    // Clear inputs
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
}

// Auto-save answers every 30 seconds
setInterval(() => {
    if (currentStudent && examForm.style.display !== 'none') {
        const formData = new FormData(document.getElementById('exam'));
        const answers = {
            q1: formData.get('q1') || '',
            q2: formData.get('q2') || '',
            q3: formData.get('q3') || '',
            q4: formData.get('q4') || '',
            q5: formData.get('q5') || '',
            q6: formData.get('q6') || ''
        };
        
        // Save to localStorage as backup
        localStorage.setItem('exam_answers', JSON.stringify(answers));
        localStorage.setItem('uploaded_files', JSON.stringify(uploadedFiles));
    }
}, 30000);

// Load saved answers on page load
window.addEventListener('load', () => {
    const savedAnswers = localStorage.getItem('exam_answers');
    const savedFiles = localStorage.getItem('uploaded_files');
    
    if (savedAnswers) {
        const answers = JSON.parse(savedAnswers);
        Object.keys(answers).forEach(key => {
            const textarea = document.querySelector(`textarea[name="${key}"]`);
            if (textarea) {
                textarea.value = answers[key];
            }
        });
    }
    
    if (savedFiles) {
        uploadedFiles = JSON.parse(savedFiles);
        // Note: File previews won't be restored due to security restrictions
    }
});

// Prevent form submission on Enter key in textareas
document.querySelectorAll('textarea').forEach(textarea => {
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            document.getElementById('exam').dispatchEvent(new Event('submit'));
        }
    });
});

// Warn user before leaving page
window.addEventListener('beforeunload', (e) => {
    if (currentStudent && examForm.style.display !== 'none') {
        e.preventDefault();
        e.returnValue = 'Bạn có chắc muốn rời khỏi trang? Bài làm sẽ bị mất!';
    }
}); 
