pipeline {
    agent any

    parameters {
        choice(
            name: 'DEPLOYMENT_ACTION',
            choices: ['DEPLOY', 'ROLLBACK'],
            description: 'Select deployment action'
        )

        choice(
            name: 'ENVIRONMENT',
            choices: ['UAT', 'PRODUCTION'],
            description: 'Select environment'
        )

        string(
            name: 'VERSION',
            defaultValue: '4.2.1',
            description: 'Version to deploy, example: 4.2.1'
        )

        choice(
            name: 'CONFIRM_PROD',
            choices: ['YES', 'NO'],
            description: 'Required YES for production deployment'
        )
    }

    environment {
        APP_NAME = 'retail-app'
        NETWORK_NAME = 'retail-network'
        PRODUCTION_CONTAINER = 'retail-app-production'
        CANDIDATE_CONTAINER = 'retail-app-candidate'
        PRODUCTION_PORT = '8081'
        CANDIDATE_PORT = '8082'
    }

    stages {

        stage('Show Parameters') {
            steps {
                echo "=========================================="
                echo "DEPLOYMENT ACTION : ${params.DEPLOYMENT_ACTION}"
                echo "ENVIRONMENT       : ${params.ENVIRONMENT}"
                echo "VERSION           : ${params.VERSION}"
                echo "CONFIRM PROD      : ${params.CONFIRM_PROD}"
                echo "=========================================="
            }
        }

        stage('Production Guard') {
            steps {
                script {
                    if (params.ENVIRONMENT == 'PRODUCTION' &&
                        params.CONFIRM_PROD != 'YES') {

                        error("PRODUCTION DEPLOYMENT BLOCKED: CONFIRM_PROD must be YES")
                    }

                    echo "Production guard passed."
                }
            }
        }

        stage('Validate Git Version') {
            steps {
                bat """
                    git config --global --add safe.directory "%WORKSPACE%"
                    git fetch --tags --force

                    echo Checking requested Git tag...
                    git rev-parse refs/tags/v${params.VERSION}
                """
            }
        }

        stage('Checkout Selected Version') {
            steps {
                bat """
                    git config --global --add safe.directory "%WORKSPACE%"

                    echo Cleaning Jenkins workspace...
                    git reset --hard
                    git clean -fd

                    echo Checking out version v${params.VERSION}...
                    git checkout --force tags/v${params.VERSION}

                    echo Selected commit:
                    git rev-parse HEAD

                    echo Selected version:
                    git describe --tags --exact-match HEAD
                """
            }
        }

        stage('Build Docker Image') {
            when {
                expression {
                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {
                bat """
                    echo ==========================================
                    echo Building Docker image
                    echo Image: %APP_NAME%:${params.VERSION}
                    echo ==========================================

                    docker build --no-cache -t %APP_NAME%:${params.VERSION} .
                """
            }
        }

        stage('Record Previous Production') {
            when {
                expression {
                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {
                script {
                    def oldImage = bat(
                        script: """
                            docker inspect --format="{{.Config.Image}}" %PRODUCTION_CONTAINER%
                        """,
                        returnStdout: true
                    ).trim()

                    env.PREVIOUS_IMAGE = oldImage

                    echo "=========================================="
                    echo "Previous production image: ${env.PREVIOUS_IMAGE}"
                    echo "New requested image       : ${APP_NAME}:${params.VERSION}"
                    echo "=========================================="
                }
            }
        }

        stage('Deploy Candidate') {
            when {
                expression {
                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {
                script {

                    try {

                        bat """
                            echo ==========================================
                            echo Starting candidate version
                            echo ${APP_NAME}:${params.VERSION}
                            echo Port: %CANDIDATE_PORT%
                            echo ==========================================

                            docker rm -f %CANDIDATE_CONTAINER% 2>NUL || exit /b 0

                            docker run -d ^
                              --name %CANDIDATE_CONTAINER% ^
                              --network %NETWORK_NAME% ^
                              -p %CANDIDATE_PORT%:3000 ^
                              -e APP_VERSION=${params.VERSION} ^
                              -e ENVIRONMENT=${params.ENVIRONMENT} ^
                              %APP_NAME%:${params.VERSION}
                        """

                        echo "Candidate container started."

                        echo "Waiting for Docker health check..."

                        bat """
                            timeout /t 15 /nobreak
                        """

                        def healthStatus = bat(
                            script: """
                                docker inspect --format="{{.State.Health.Status}}" %CANDIDATE_CONTAINER%
                            """,
                            returnStdout: true
                        ).trim()

                        echo "Candidate health status: ${healthStatus}"

                        if (healthStatus != "healthy") {
                            error("HEALTH_CHECK_FAILED")
                        }

                        echo "Candidate health check PASSED."

                    } catch (Exception deploymentError) {

                        echo "=========================================="
                        echo "HEALTH CHECK FAILED"
                        echo "Starting automatic rollback..."
                        echo "=========================================="

                        bat """
                            echo Stopping failed candidate...
                            docker rm -f %CANDIDATE_CONTAINER% 2>NUL || exit /b 0
                        """

                        echo "Failed candidate stopped and removed."

                        bat """
                            echo ==========================================
                            echo Restoring previous production version
                            echo Image: %PREVIOUS_IMAGE%
                            echo ==========================================

                            docker rm -f %PRODUCTION_CONTAINER% 2>NUL || exit /b 0

                            docker run -d ^
                              --name %PRODUCTION_CONTAINER% ^
                              --network %NETWORK_NAME% ^
                              -p %PRODUCTION_PORT%:3000 ^
                              -e APP_VERSION=4.2.1 ^
                              -e ENVIRONMENT=PRODUCTION ^
                              %PREVIOUS_IMAGE%
                        """

                        echo "Previous production version started."

                        bat """
                            timeout /t 15 /nobreak
                        """

                        def rollbackHealth = bat(
                            script: """
                                docker inspect --format="{{.State.Health.Status}}" %PRODUCTION_CONTAINER%
                            """,
                            returnStdout: true
                        ).trim()

                        echo "Rollback health status: ${rollbackHealth}"

                        if (rollbackHealth == "healthy") {

                            echo "=========================================="
                            echo "ROLLBACK VERIFIED"
                            echo "Previous version is healthy."
                            echo "Restored image: ${env.PREVIOUS_IMAGE}"
                            echo "=========================================="

                        } else {

                            error("CRITICAL: AUTOMATIC ROLLBACK FAILED")
                        }

                        error(
                            "Deployment of ${params.VERSION} failed. " +
                            "Automatic rollback to ${env.PREVIOUS_IMAGE} completed successfully."
                        )
                    }
                }
            }
        }

        stage('Promote Candidate') {
            when {
                expression {
                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {
                script {

                    bat """
                        echo ==========================================
                        echo Candidate health check passed.
                        echo Promoting candidate to production.
                        echo ==========================================

                        docker rm -f %PRODUCTION_CONTAINER% 2>NUL || exit /b 0

                        docker run -d ^
                          --name %PRODUCTION_CONTAINER% ^
                          --network %NETWORK_NAME% ^
                          -p %PRODUCTION_PORT%:3000 ^
                          -e APP_VERSION=${params.VERSION} ^
                          -e ENVIRONMENT=${params.ENVIRONMENT} ^
                          %APP_NAME%:${params.VERSION}

                        docker rm -f %CANDIDATE_CONTAINER% 2>NUL || exit /b 0
                    """

                    echo "New version promoted to production."
                }
            }
        }

        stage('Final Production Health Check') {
            when {
                expression {
                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {
                bat """
                    timeout /t 10 /nobreak

                    echo Final production health status:

                    docker inspect --format="{{.State.Health.Status}}" %PRODUCTION_CONTAINER%
                """
            }
        }

        stage('Rollback Action') {
            when {
                expression {
                    params.DEPLOYMENT_ACTION == 'ROLLBACK'
                }
            }

            steps {
                echo "Manual rollback requested."

                bat """
                    echo Current production container:
                    docker inspect --format="{{.Config.Image}}" %PRODUCTION_CONTAINER%

                    echo Stopping current production...
                    docker rm -f %PRODUCTION_CONTAINER% 2>NUL || exit /b 0

                    echo Manual rollback action completed.
                """
            }
        }
    }

    post {
        always {
            echo "=========================================="
            echo "Deployment process completed."
            echo "Requested version: ${params.VERSION}"
            echo "Action: ${params.DEPLOYMENT_ACTION}"
            echo "Environment: ${params.ENVIRONMENT}"
            echo "=========================================="

            bat """
                echo Docker containers:
                docker ps -a
            """
        }
    }
}