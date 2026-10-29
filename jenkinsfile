
pipeline {
    agent { label 'hostelops-win' }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        skipDefaultCheckout(true)
    }

    environment {
        // Replace with the existing Compose project label
        // reported by: docker inspect hms-backend
        COMPOSE_PROJECT = 'hostel-management-system'
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
                    bat 'npm run test:ci --if-present'
                }
            }
        }

        stage('Docker Preflight') {
            steps {
                bat 'docker --version'
                bat 'docker compose version'
                bat 'docker info'
            }
        }

        stage('Build and Deploy Containers') {
            steps {
                withCredentials([
                    file(
                        credentialsId: 'hostelops-backend-env',
                        variable: 'HOSTELOPS_ENV_FILE'
                    )
                ]) {
                    script {
                        try {
                            bat '''
                                @echo off
                                copy /Y "%HOSTELOPS_ENV_FILE%" "backend\\.env" >NUL
                                if errorlevel 1 exit /b 1

                                docker compose -p "%COMPOSE_PROJECT%" config --quiet
                                if errorlevel 1 exit /b 1

                                docker compose -p "%COMPOSE_PROJECT%" build
                                if errorlevel 1 exit /b 1

                                docker compose -p "%COMPOSE_PROJECT%" up -d --remove-orphans
                                if errorlevel 1 exit /b 1
                            '''
                        } finally {
                            bat 'if exist backend\\.env del /F /Q backend\\.env'
                        }
                    }
                }
            }
        }

        stage('Smoke Tests') {
            steps {
                bat 'timeout /t 10 /nobreak >NUL'
                bat 'docker compose -p "%COMPOSE_PROJECT%" ps'
                bat 'curl.exe --fail --silent --show-error http://localhost:5000/api/health'
                bat 'curl.exe --fail --silent --show-error http://localhost:8081/api/health'
                bat 'curl.exe --fail --silent --show-error http://localhost:8081/'
            }
        }
    }

    post {
        success {
            echo 'HostelOps pipeline completed successfully.'
        }
        failure {
            echo 'HostelOps pipeline failed. Inspect the failed stage and logs.'
        }
    }
}
