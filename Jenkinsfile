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

        // =========================================================
        // 1. SHOW PARAMETERS
        // =========================================================

        stage('Show Parameters') {

            steps {

                echo "=========================================="
                echo "        DEPLOYMENT PARAMETERS"
                echo "=========================================="

                echo "DEPLOYMENT ACTION : ${params.DEPLOYMENT_ACTION}"
                echo "ENVIRONMENT       : ${params.ENVIRONMENT}"
                echo "VERSION           : ${params.VERSION}"
                echo "CONFIRM PROD      : ${params.CONFIRM_PROD}"

                echo "=========================================="
            }
        }


        // =========================================================
        // 2. PRODUCTION GUARD
        // =========================================================

        stage('Production Guard') {

            steps {

                script {

                    if (
                        params.ENVIRONMENT == 'PRODUCTION' &&
                        params.CONFIRM_PROD != 'YES'
                    ) {

                        error(
                            "PRODUCTION DEPLOYMENT BLOCKED: " +
                            "CONFIRM_PROD must be YES"
                        )
                    }

                    echo "Production guard passed."
                }
            }
        }


        // =========================================================
        // 3. VALIDATE GIT VERSION
        // =========================================================

        stage('Validate Git Version') {

            steps {

                bat """

                    @echo off

                    git config --global --add safe.directory "%WORKSPACE%"

                    echo Fetching Git tags...

                    git fetch --tags --force

                    echo.
                    echo Checking requested Git tag...
                    echo Tag: v${params.VERSION}

                    git rev-parse refs/tags/v${params.VERSION}

                """
            }
        }


        // =========================================================
        // 4. CHECKOUT SELECTED VERSION
        // =========================================================

        stage('Checkout Selected Version') {

            steps {

                bat """

                    @echo off

                    git config --global --add safe.directory "%WORKSPACE%"

                    echo ==========================================
                    echo Cleaning Jenkins workspace
                    echo ==========================================

                    git reset --hard

                    git clean -fd

                    echo.
                    echo ==========================================
                    echo Checking out version v${params.VERSION}
                    echo ==========================================

                    git checkout --force tags/v${params.VERSION}

                    echo.
                    echo ==========================================
                    echo Selected commit
                    echo ==========================================

                    git rev-parse HEAD

                    echo.
                    echo ==========================================
                    echo Selected version
                    echo ==========================================

                    git describe --tags --exact-match HEAD

                """
            }
        }


        // =========================================================
        // 5. BUILD DOCKER IMAGE
        // =========================================================

        stage('Build Docker Image') {

            when {

                expression {

                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {

                bat """

                    @echo off

                    echo ==========================================
                    echo BUILDING DOCKER IMAGE
                    echo ==========================================

                    echo Image:
                    echo %APP_NAME%:${params.VERSION}

                    echo.

                    docker build --no-cache ^
                        -t %APP_NAME%:${params.VERSION} .

                    echo.
                    echo Docker image build completed.

                """
            }
        }


        // =========================================================
        // 6. RECORD PREVIOUS PRODUCTION
        // =========================================================

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
                            @echo off
                            docker inspect --format="{{.Config.Image}}" %PRODUCTION_CONTAINER%
                        """,
                        returnStdout: true
                    ).trim()

                    env.PREVIOUS_IMAGE = oldImage

                    echo "=========================================="
                    echo "PREVIOUS PRODUCTION IMAGE"
                    echo "=========================================="

                    echo "Previous image : ${env.PREVIOUS_IMAGE}"

                    echo "New image      : ${APP_NAME}:${params.VERSION}"

                    echo "=========================================="
                }
            }
        }


        // =========================================================
        // 7. DEPLOY CANDIDATE
        // =========================================================

        stage('Deploy Candidate') {

            when {

                expression {

                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {

                script {

                    try {

                        echo "=========================================="
                        echo "STARTING CANDIDATE"
                        echo "=========================================="

                        bat """

                            @echo off

                            echo Removing old candidate if present...

                            docker rm -f %CANDIDATE_CONTAINER% 2>NUL || exit /b 0

                            echo.
                            echo Starting candidate container...

                            docker run -d ^
                                --name %CANDIDATE_CONTAINER% ^
                                --network %NETWORK_NAME% ^
                                -p %CANDIDATE_PORT%:3000 ^
                                -e APP_VERSION=${params.VERSION} ^
                                -e ENVIRONMENT=${params.ENVIRONMENT} ^
                                -e HEALTH_STATUS=OK ^
                                -e PAYMENT_STATUS=OK ^
                                %APP_NAME%:${params.VERSION}

                        """

                        echo "Candidate container started."

                        echo "Waiting for Docker health check..."

                        // Windows Jenkins-safe wait
                        bat """

                            @echo off

                            ping 127.0.0.1 -n 16 >nul

                        """


                        // =================================================
                        // CHECK CANDIDATE HEALTH
                        // =================================================

                        def healthStatus = bat(
                            script: """
                                @echo off
                                docker inspect --format="{{.State.Health.Status}}" %CANDIDATE_CONTAINER%
                            """,
                            returnStdout: true
                        ).trim()

                        echo "=========================================="
                        echo "CANDIDATE HEALTH STATUS"
                        echo "=========================================="

                        echo "Candidate health: ${healthStatus}"

                        echo "=========================================="


                        if (healthStatus != "healthy") {

                            error("HEALTH_CHECK_FAILED")
                        }


                        echo "Candidate health check PASSED."

                    }


                    // =====================================================
                    // AUTOMATIC ROLLBACK
                    // =====================================================

                    catch (Exception deploymentError) {

                        echo ""
                        echo "=========================================="
                        echo "       HEALTH CHECK FAILED"
                        echo "=========================================="

                        echo "Requested version: ${params.VERSION}"

                        echo "Starting automatic rollback..."

                        echo "=========================================="


                        // =================================================
                        // STOP FAILED CANDIDATE
                        // =================================================

                        bat """

                            @echo off

                            echo Stopping failed candidate...

                            docker rm -f %CANDIDATE_CONTAINER% 2>NUL || exit /b 0

                        """

                        echo "Failed candidate stopped and removed."


                        // =================================================
                        // RESTORE PREVIOUS PRODUCTION
                        // =================================================

                        echo ""
                        echo "=========================================="
                        echo "RESTORING PREVIOUS PRODUCTION"
                        echo "=========================================="

                        echo "Previous image: ${env.PREVIOUS_IMAGE}"


                        bat """

                            @echo off

                            echo Removing failed production container if present...

                            docker rm -f %PRODUCTION_CONTAINER% 2>NUL || exit /b 0

                            echo.
                            echo Starting previous production version...

                            docker run -d ^
                                --name %PRODUCTION_CONTAINER% ^
                                --network %NETWORK_NAME% ^
                                -p %PRODUCTION_PORT%:3000 ^
                                -e APP_VERSION=4.2.1 ^
                                -e ENVIRONMENT=PRODUCTION ^
                                -e HEALTH_STATUS=OK ^
                                -e PAYMENT_STATUS=OK ^
                                %PREVIOUS_IMAGE%

                        """

                        echo "Previous production version started."


                        // =================================================
                        // WAIT FOR ROLLBACK HEALTH CHECK
                        // =================================================

                        echo "Waiting for rollback health check..."

                        bat """

                            @echo off

                            ping 127.0.0.1 -n 16 >nul

                        """


                        // =================================================
                        // CHECK ROLLBACK HEALTH
                        // =================================================

                        def rollbackHealth = bat(
                            script: """
                                @echo off
                                docker inspect --format="{{.State.Health.Status}}" %PRODUCTION_CONTAINER%
                            """,
                            returnStdout: true
                        ).trim()


                        echo ""
                        echo "=========================================="
                        echo "ROLLBACK HEALTH STATUS"
                        echo "=========================================="

                        echo "Rollback health: ${rollbackHealth}"

                        echo "=========================================="


                        // =================================================
                        // VERIFY ROLLBACK
                        // =================================================

                        if (rollbackHealth == "healthy") {

                            echo ""
                            echo "=========================================="
                            echo "          ROLLBACK VERIFIED"
                            echo "=========================================="

                            echo "Failed version : ${params.VERSION}"

                            echo "Restored image : ${env.PREVIOUS_IMAGE}"

                            echo "Final status   : HEALTHY"

                            echo "=========================================="

                        }

                        else {

                            error(
                                "CRITICAL: AUTOMATIC ROLLBACK FAILED"
                            )
                        }


                        // =================================================
                        // IMPORTANT:
                        // Deployment must remain FAILURE
                        // =================================================

                        error(
                            "Deployment of ${params.VERSION} failed. " +
                            "Automatic rollback to ${env.PREVIOUS_IMAGE} " +
                            "completed successfully."
                        )
                    }
                }
            }
        }


        // =========================================================
        // 8. PROMOTE CANDIDATE
        // =========================================================

        stage('Promote Candidate') {

            when {

                expression {

                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {

                script {

                    bat """

                        @echo off

                        echo ==========================================
                        echo CANDIDATE HEALTH CHECK PASSED
                        echo ==========================================

                        echo Promoting candidate to production...

                        echo.

                        docker rm -f %PRODUCTION_CONTAINER% 2>NUL || exit /b 0

                        docker run -d ^
                            --name %PRODUCTION_CONTAINER% ^
                            --network %NETWORK_NAME% ^
                            -p %PRODUCTION_PORT%:3000 ^
                            -e APP_VERSION=${params.VERSION} ^
                            -e ENVIRONMENT=${params.ENVIRONMENT} ^
                            -e HEALTH_STATUS=OK ^
                            -e PAYMENT_STATUS=OK ^
                            %APP_NAME%:${params.VERSION}

                        echo.

                        echo Removing candidate container...

                        docker rm -f %CANDIDATE_CONTAINER% 2>NUL || exit /b 0

                        echo.
                        echo New version promoted to production.

                    """
                }
            }
        }


        // =========================================================
        // 9. FINAL PRODUCTION HEALTH CHECK
        // =========================================================

        stage('Final Production Health Check') {

            when {

                expression {

                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {

                bat """

                    @echo off

                    echo ==========================================
                    echo FINAL PRODUCTION HEALTH CHECK
                    echo ==========================================

                    ping 127.0.0.1 -n 11 >nul

                    echo.

                    docker inspect --format="{{.State.Health.Status}}" %PRODUCTION_CONTAINER%

                    echo.

                    echo Final production container:

                    docker ps --filter "name=%PRODUCTION_CONTAINER%"

                """
            }
        }


        // =========================================================
        // 10. MANUAL ROLLBACK ACTION
        // =========================================================

        stage('Rollback Action') {

            when {

                expression {

                    params.DEPLOYMENT_ACTION == 'ROLLBACK'
                }
            }

            steps {

                echo "=========================================="
                echo "MANUAL ROLLBACK REQUESTED"
                echo "=========================================="


                bat """

                    @echo off

                    echo Current production image:

                    docker inspect --format="{{.Config.Image}}" %PRODUCTION_CONTAINER%

                    echo.

                    echo Stopping current production...

                    docker rm -f %PRODUCTION_CONTAINER% 2>NUL || exit /b 0

                    echo.

                    echo Manual rollback action completed.

                """
            }
        }
    }


    // =============================================================
    // POST ACTIONS
    // =============================================================

    post {

        always {

            echo ""
            echo "=========================================="
            echo "      DEPLOYMENT PROCESS COMPLETED"
            echo "=========================================="

            echo "Requested version : ${params.VERSION}"

            echo "Action            : ${params.DEPLOYMENT_ACTION}"

            echo "Environment       : ${params.ENVIRONMENT}"

            echo "=========================================="


            bat """

                @echo off

                echo.
                echo ==========================================
                echo DOCKER CONTAINERS
                echo ==========================================

                docker ps -a

            """
        }
    }
}