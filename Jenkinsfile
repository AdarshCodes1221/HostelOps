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
        // Must match your existing Docker Compose project.
        COMPOSE_PROJECT = 'hostelmanagementsystem'
        HOSTELOPS_UPLOADS_PATH = 'D:/PROJECTS/Hostel Management System/backend/uploads'
    }

    stages {

        stage('Checkout HostelOps') {
            steps {
                checkout scm
                bat 'git rev-parse --short HEAD'
            }
        }

        stage('Frontend CI') {
            steps {
                dir('frontend') {
                    bat 'node --version'
                    bat 'npm ci'
                    bat 'npm run build'
                    bat 'npm run lint --if-present'
                }
            }
        }

        stage('Backend CI') {
            steps {
                dir('backend') {
                    bat 'node --version'
                    bat 'npm ci'
                    bat 'node --check server.js'
                    bat 'npm run lint --if-present'
                }
            }
        }

        stage('Docker Preflight') {
            steps {
                bat 'docker --version'
                bat 'docker compose version'
                bat 'docker info'
                bat 'trivy --version'
            }
        }

        stage('SonarQube Analysis') {
            steps {
                script {
                    def scannerHome = tool 'HostelOps-SonarScanner'

                    // Must exactly match Manage Jenkins > System.
                    withSonarQubeEnv('SonarQube') {
                        bat "\"${scannerHome}\\bin\\sonar-scanner.bat\""
                    }
                }
            }
        }

        stage('SonarQube Quality Gate') {
            steps {
                timeout(time: 10, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

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

        stage('Build Docker Images') {
            steps {
                bat '''
                    docker compose -p "%COMPOSE_PROJECT%" build
                    if errorlevel 1 exit /b 1
                '''
            }
        }

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
                        Write-Host "Scanning image: $image"

                        & trivy image `
                            --ignore-unfixed `
                            --severity HIGH,CRITICAL `
                            --exit-code 1 `
                            $image

                        if ($LASTEXITCODE -ne 0) {
                            Write-Error "Trivy scan failed for image: $image"
                            exit $LASTEXITCODE
                        }
                    }
                '''
            }
        }

        stage('Deploy Containers') {
            steps {
                bat '''
                    docker compose -p "%COMPOSE_PROJECT%" up -d
                    if errorlevel 1 exit /b 1
                '''
            }
        }

        stage('Smoke Tests') {
            steps {
                bat 'timeout /t 10 /nobreak >NUL'

                bat 'docker compose -p "%COMPOSE_PROJECT%" ps'

                bat '''
                    curl.exe --fail --silent --show-error ^
                    http://localhost:5000/api/health
                    if errorlevel 1 exit /b 1
                '''

                bat '''
                    curl.exe --fail --silent --show-error ^
                    http://localhost:8081/api/health
                    if errorlevel 1 exit /b 1
                '''

                bat '''
                    curl.exe --fail --silent --show-error ^
                    http://localhost:8081/
                    if errorlevel 1 exit /b 1
                '''
            }
        }
    }

    post {
        always {
            // Remove the temporary backend environment file.
            bat '''
                @echo off
                if exist backend\\.env del /F /Q backend\\.env
                exit /b 0
            '''
        }

        success {
            echo 'HostelOps CI/CD passed: build, SonarQube quality gate, Trivy scan, deployment and smoke tests.'
        }

        failure {
            echo 'HostelOps pipeline failed. Inspect the first failing stage in Console Output.'
        }
    }
}