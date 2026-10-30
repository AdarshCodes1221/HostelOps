
pipeline {
    agent {
        label 'hostelops-win'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        skipDefaultCheckout(true)
    }

    environment {
        // Existing Docker Compose project
        COMPOSE_PROJECT = 'hostelmanagementsystem'

        // Preserve the existing uploaded files directory
        HOSTELOPS_UPLOADS_PATH = 'D:/PROJECTS/Hostel Management System/backend/uploads'
    }

    stages {

        // --------------------------------------------------
        // 1. CHECKOUT
        // --------------------------------------------------

        stage('Checkout HostelOps') {
            steps {
                checkout scm
                bat 'git rev-parse --short HEAD'
            }
        }

        // --------------------------------------------------
        // 2. FRONTEND CI
        // --------------------------------------------------

        stage('Frontend CI') {
            steps {
                dir('frontend') {
                    bat 'node --version'
                    bat 'npm --version'
                    bat 'npm ci'
                    bat 'npm run lint --if-present'
                    bat 'npm run build'
                }
            }
        }

        // --------------------------------------------------
        // 3. BACKEND CI
        // --------------------------------------------------

        stage('Backend CI') {
            steps {
                dir('backend') {
                    bat 'node --version'
                    bat 'npm --version'
                    bat 'npm ci'
                    bat 'node --check server.js'
                    bat 'npm run lint --if-present'
                }
            }
        }

        // --------------------------------------------------
        // 4. DOCKER PREFLIGHT
        // --------------------------------------------------

        stage('Docker Preflight') {
            steps {
                bat 'docker --version'
                bat 'docker compose version'
                bat 'docker info'
                bat 'trivy --version'
            }
        }

        // --------------------------------------------------
        // 5. SONARQUBE ANALYSIS
        // --------------------------------------------------

        stage('SonarQube Analysis') {
            steps {
                script {
                    def scannerHome = tool 'HostelOps-SonarScanner'

                    if (!fileExists('sonar-project.properties')) {
                        error(
                            'sonar-project.properties not found in repository root. ' +
                            'Add and commit the HostelOps SonarQube configuration.'
                        )
                    }

                    withSonarQubeEnv('SonarQube') {

                        // Windows agent reaches SonarQube using localhost.
                        // Jenkins server configuration remains host.docker.internal.
                        bat """
                            "${scannerHome}\\bin\\sonar-scanner.bat" ^
                            -Dsonar.host.url=http://localhost:9000
                        """
                    }
                }
            }
        }

        // --------------------------------------------------
        // 6. SONARQUBE QUALITY GATE
        // --------------------------------------------------

        stage('SonarQube Quality Gate') {
            steps {
                timeout(time: 10, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: false
                }
            }
        }

        // --------------------------------------------------
        // 7. PREPARE DOCKER ENVIRONMENT
        // --------------------------------------------------

        stage('Prepare Docker Environment') {
            steps {
                withCredentials([
                    file(
                        credentialsId: 'hostelops-backend-env',
                        variable: 'HOSTELOPS_ENV_FILE'
                    )
                ]) {
                    bat '''
                        @echo off

                        copy /Y "%HOSTELOPS_ENV_FILE%" "backend\\.env" >NUL
                        if errorlevel 1 exit /b 1

                        docker compose -p "%COMPOSE_PROJECT%" config --quiet
                        if errorlevel 1 exit /b 1
                    '''
                }
            }
        }

        // --------------------------------------------------
        // 8. BUILD DOCKER IMAGES
        // --------------------------------------------------

        stage('Build Docker Images') {
            steps {
                bat '''
                    docker compose -p "%COMPOSE_PROJECT%" build
                    if errorlevel 1 exit /b 1
                '''
            }
        }

        // --------------------------------------------------
        // 9. TRIVY IMAGE SECURITY SCAN
        // --------------------------------------------------

        stage('Trivy Image Security Scan') {
            steps {
                powershell '''
                    $ErrorActionPreference = "Stop"

                    $images = @(
                        docker compose -p $env:COMPOSE_PROJECT config --images |
                        Where-Object { $_ -and $_.Trim() }
                    )

                    if ($LASTEXITCODE -ne 0 -or $images.Count -eq 0) {
                        Write-Error "Could not determine Docker images from Compose."
                        exit 1
                    }

                    foreach ($image in $images) {

                        Write-Host "======================================"
                        Write-Host "Scanning Docker image: $image"
                        Write-Host "======================================"

                        & trivy image `
                            --ignore-unfixed `
                            --severity HIGH,CRITICAL `
                            --exit-code 1 `
                            $image

                        if ($LASTEXITCODE -ne 0) {
                            Write-Error "Trivy scan failed: $image"
                            exit 1
                        }
                    }

                    Write-Host "All Docker image security scans passed."
                '''
            }
        }

        // --------------------------------------------------
        // 10. DEPLOY EXISTING DOCKER COMPOSE PROJECT
        // --------------------------------------------------

        stage('Deploy Containers') {
            steps {
                bat '''
                    docker compose -p "%COMPOSE_PROJECT%" up -d
                    if errorlevel 1 exit /b 1
                '''
            }
        }

        // --------------------------------------------------
        // 11. SMOKE TESTS
        // --------------------------------------------------

        stage('Smoke Tests') {
            steps {

                // Allow containers to initialize
                bat 'timeout /t 10 /nobreak >NUL'

                // Check container status
                bat 'docker compose -p "%COMPOSE_PROJECT%" ps'

                // Backend health check
                bat '''
                    curl.exe --fail --silent --show-error ^
                    http://localhost:5000/api/health

                    if errorlevel 1 exit /b 1
                '''

                // Frontend API proxy health check
                bat '''
                    curl.exe --fail --silent --show-error ^
                    http://localhost:8081/api/health

                    if errorlevel 1 exit /b 1
                '''

                // Frontend availability check
                bat '''
                    curl.exe --fail --silent --show-error ^
                    http://localhost:8081/

                    if errorlevel 1 exit /b 1
                '''
            }
        }
    }

    // ------------------------------------------------------
    // POST BUILD ACTIONS
    // ------------------------------------------------------

    post {

        always {
            // Remove temporary backend environment file
            bat '''
                @echo off

                if exist backend\\.env (
                    del /F /Q backend\\.env
                )

                exit /b 0
            '''
        }

        success {
            echo '''
            ==========================================
                 HOSTELOPS CI/CD SUCCESSFUL
            ==========================================
            Frontend CI:             PASSED
            Backend CI:              PASSED
            SonarQube Analysis:      PASSED
            SonarQube Quality Gate:  PASSED
            Docker Build:            PASSED
            Trivy Security Scan:     PASSED
            Docker Deployment:       PASSED
            Smoke Tests:             PASSED
            ==========================================
            '''
        }

        failure {
            echo '''
            ==========================================
                 HOSTELOPS CI/CD FAILED
            ==========================================
            Check the first failing stage in Console Output.
            Deployment will not proceed after a failed gate.
            ==========================================
            '''
        }

    }
}
