pipeline {

    agent any

    parameters {

        choice(
            name: 'ENVIRONMENT',
            choices: ['DEV', 'UAT', 'PRODUCTION'],
            description: 'Select deployment environment'
        )

        choice(
            name: 'ACTION',
            choices: ['DEPLOY', 'ROLLBACK'],
            description: 'Select deployment action'
        )

        string(
            name: 'VERSION',
            defaultValue: '5.0.0',
            description: 'Application version'
        )

        choice(
            name: 'RUN_TESTS',
            choices: ['YES', 'NO'],
            description: 'Run application tests'
        )

        choice(
            name: 'PRODUCTION_CONFIRM',
            choices: ['NO', 'YES'],
            description: 'Required YES for production deployment or rollback'
        )
    }

    environment {
        IMAGE_NAME = 'customer-app'
    }

    stages {

        stage('Validate Parameters') {
            steps {
                script {

                    if (!(params.ENVIRONMENT in ['DEV', 'UAT', 'PRODUCTION'])) {
                        error("Invalid environment selected")
                    }

                    if (!(params.ACTION in ['DEPLOY', 'ROLLBACK'])) {
                        error("Invalid action selected")
                    }

                    if (!(params.VERSION ==~ /^[0-9]+\.[0-9]+\.[0-9]+$/)) {
                        error("Invalid VERSION. Use format X.Y.Z")
                    }

                    if (params.ENVIRONMENT == 'PRODUCTION' &&
                        params.PRODUCTION_CONFIRM != 'YES') {

                        error("Production deployment or rollback requires PRODUCTION_CONFIRM=YES")
                    }

                    if (params.ENVIRONMENT != 'PRODUCTION' &&
                        params.PRODUCTION_CONFIRM == 'YES') {

                        error("PRODUCTION_CONFIRM=YES is only valid for PRODUCTION")
                    }

                    echo "========================================"
                    echo "PARAMETER VALIDATION PASSED"
                    echo "========================================"
                    echo "Environment : ${params.ENVIRONMENT}"
                    echo "Action      : ${params.ACTION}"
                    echo "Version     : ${params.VERSION}"
                    echo "Run Tests   : ${params.RUN_TESTS}"
                    echo "========================================"
                }
            }
        }

        stage('Resolve Environment') {
            steps {
                script {

                    if (params.ENVIRONMENT == 'DEV') {

                        env.DEPLOY_BRANCH = 'develop'
                        env.APP_CONTAINER = 'customer-app-dev'
                        env.DB_CONTAINER = 'customer-db-dev'
                        env.NETWORK_NAME = 'customer-dev-net'
                        env.DB_VOLUME = 'customer-db-dev-data'
                        env.HOST_PORT = '8083'

                    } else if (params.ENVIRONMENT == 'UAT') {

                        env.DEPLOY_BRANCH = 'release'
                        env.APP_CONTAINER = 'customer-app-uat'
                        env.DB_CONTAINER = 'customer-db-uat'
                        env.NETWORK_NAME = 'customer-uat-net'
                        env.DB_VOLUME = 'customer-db-uat-data'
                        env.HOST_PORT = '8082'

                    } else {

                        env.DEPLOY_BRANCH = 'main'
                        env.APP_CONTAINER = 'customer-app-prod'
                        env.DB_CONTAINER = 'customer-db-prod'
                        env.NETWORK_NAME = 'customer-prod-net'
                        env.DB_VOLUME = 'customer-db-prod-data'
                        env.HOST_PORT = '8081'
                    }

                    echo "========================================"
                    echo "ENVIRONMENT CONFIGURATION"
                    echo "========================================"
                    echo "Environment : ${params.ENVIRONMENT}"
                    echo "Branch      : ${env.DEPLOY_BRANCH}"
                    echo "Application : ${env.APP_CONTAINER}"
                    echo "Database    : ${env.DB_CONTAINER}"
                    echo "Network     : ${env.NETWORK_NAME}"
                    echo "DB Volume   : ${env.DB_VOLUME}"
                    echo "Host Port   : ${env.HOST_PORT}"
                    echo "========================================"
                }
            }
        }

        stage('Checkout Selected Branch') {
            steps {
                bat """
                    echo ========================================
                    echo CHECKING OUT SELECTED BRANCH
                    echo ========================================

                    git fetch --all
                    git checkout ${env.DEPLOY_BRANCH}
                    git pull origin ${env.DEPLOY_BRANCH}

                    echo.
                    echo Current branch:
                    git branch --show-current
                """
            }
        }

        stage('Run Tests') {
            when {
                expression {
                    params.RUN_TESTS == 'YES'
                }
            }

            steps {
                bat """
                    echo ========================================
                    echo INSTALLING NODE DEPENDENCIES
                    echo ========================================

                    cd app
                    npm ci
                    cd ..

                    echo ========================================
                    echo RUNNING TESTS
                    echo ========================================

                    app\\node_modules\\.bin\\jest.cmd --config=jest.config.js
                """
            }
        }

        stage('Build Docker Image') {
            when {
                expression {
                    params.ACTION == 'DEPLOY'
                }
            }

            steps {
                bat """
                    echo ========================================
                    echo BUILDING DOCKER IMAGE
                    echo ========================================

                    docker build -t ${IMAGE_NAME}:${params.VERSION} .

                    echo.
                    echo Docker image:
                    docker images ${IMAGE_NAME}
                """
            }
        }

        stage('Validate Docker Network') {
            steps {
                bat """
                    echo ========================================
                    echo VALIDATING DOCKER NETWORK
                    echo ========================================

                    docker network inspect ${env.NETWORK_NAME} >nul 2>&1

                    if errorlevel 1 (
                        echo Network does not exist.
                        echo Creating ${env.NETWORK_NAME}...

                        docker network create ${env.NETWORK_NAME}

                        if errorlevel 1 (
                            echo Failed to create Docker network.
                            exit /b 1
                        )
                    )

                    echo Network ${env.NETWORK_NAME} is ready.
                """
            }
        }

        stage('Deploy Database') {
            when {
                expression {
                    params.ACTION == 'DEPLOY'
                }
            }

            steps {
                bat """
                    echo ========================================
                    echo DEPLOYING DATABASE
                    echo ========================================

                    docker inspect ${env.DB_CONTAINER} >nul 2>&1

                    if not errorlevel 1 (

                        echo Database container already exists.
                        echo Starting database container...

                        docker start ${env.DB_CONTAINER}

                    ) else (

                        echo Creating database container...

                        docker run -d ^
                          --name ${env.DB_CONTAINER} ^
                          --network ${env.NETWORK_NAME} ^
                          -v ${env.DB_VOLUME}:/var/lib/mysql ^
                          -e MYSQL_ROOT_PASSWORD=RootPass123! ^
                          -e MYSQL_DATABASE=customerdb ^
                          -e MYSQL_USER=customeruser ^
                          -e MYSQL_PASSWORD=CustomerPass123! ^
                          mysql:8.0
                    )

                    echo.
                    echo Database container status:

                    docker ps -a --filter "name=${env.DB_CONTAINER}"
                """
            }
        }

        stage('Wait for Database') {
            when {
                expression {
                    params.ACTION == 'DEPLOY'
                }
            }

            steps {
                bat """
                    echo ========================================
                    echo WAITING FOR DATABASE
                    echo ========================================

                    ping -n 16 127.0.0.1 >nul

                    docker exec ${env.DB_CONTAINER} ^
                    mysqladmin ping ^
                    -h localhost ^
                    -u root ^
                    -pRootPass123! ^
                    --silent

                    if errorlevel 1 (
                        echo Database is not ready.
                        echo Database health check FAILED.
                        exit /b 1
                    )

                    echo Database is ready.
                """
            }
        }

        stage('Deploy Application') {
            when {
                expression {
                    params.ACTION == 'DEPLOY'
                }
            }

            steps {
                bat """
                    echo ========================================
                    echo DEPLOYING APPLICATION
                    echo ========================================

                    docker rm -f ${env.APP_CONTAINER} >nul 2>&1

                    docker run -d ^
                      --name ${env.APP_CONTAINER} ^
                      --network ${env.NETWORK_NAME} ^
                      -p ${env.HOST_PORT}:3000 ^
                      -e ENVIRONMENT=${params.ENVIRONMENT} ^
                      -e APP_VERSION=${params.VERSION} ^
                      -e DB_HOST=${env.DB_CONTAINER} ^
                      -e DB_USER=customeruser ^
                      -e DB_PASSWORD=CustomerPass123! ^
                      -e DB_NAME=customerdb ^
                      ${IMAGE_NAME}:${params.VERSION}

                    echo.
                    echo Application container status:

                    docker ps -a --filter "name=${env.APP_CONTAINER}"
                """
            }
        }

        stage('Validate Deployment') {
            when {
                expression {
                    params.ACTION == 'DEPLOY'
                }
            }

            steps {
                bat """
                    echo ========================================
                    echo VALIDATING APPLICATION DEPLOYMENT
                    echo ========================================

                    ping -n 11 127.0.0.1 >nul

                    echo.
                    echo Checking application container:

                    docker ps --filter "name=${env.APP_CONTAINER}"

                    echo.
                    echo Checking database container:

                    docker ps --filter "name=${env.DB_CONTAINER}"

                    echo.
                    echo Checking Docker network:

                    docker network inspect ${env.NETWORK_NAME}

                    echo.
                    echo Checking application health:

                    curl.exe -f http://127.0.0.1:${env.HOST_PORT}/health

                    if errorlevel 1 (
                        echo Application health check FAILED.
                        exit /b 1
                    )

                    echo.
                    echo Application health check PASSED.
                """
            }
        }

        stage('Validate Database Reachability') {
            when {
                expression {
                    params.ACTION == 'DEPLOY'
                }
            }

            steps {
                bat """
                    echo ========================================
                    echo VALIDATING DATABASE REACHABILITY
                    echo ========================================

                    curl.exe -f http://127.0.0.1:${env.HOST_PORT}/db-test

                    if errorlevel 1 (
                        echo Database reachability FAILED.
                        exit /b 1
                    )

                    echo.
                    echo Database reachability PASSED.
                """
            }
        }

        stage('Deployment Summary') {
            when {
                expression {
                    params.ACTION == 'DEPLOY'
                }
            }

            steps {
                bat """
                    echo.
                    echo ========================================
                    echo       DEPLOYMENT SUCCESSFUL
                    echo ========================================

                    echo Environment : ${params.ENVIRONMENT}
                    echo Version     : ${params.VERSION}
                    echo Branch      : ${env.DEPLOY_BRANCH}
                    echo Application : ${env.APP_CONTAINER}
                    echo Database    : ${env.DB_CONTAINER}
                    echo Network     : ${env.NETWORK_NAME}
                    echo Host Port   : ${env.HOST_PORT}
                    echo URL         : http://127.0.0.1:${env.HOST_PORT}

                    echo ========================================
                """
            }
        }

        stage('Rollback') {
            when {
                expression {
                    params.ACTION == 'ROLLBACK'
                }
            }

            steps {
                script {

                    echo "========================================"
                    echo "ROLLBACK REQUESTED"
                    echo "========================================"

                    echo "Environment     : ${params.ENVIRONMENT}"
                    echo "Rollback Version: ${params.VERSION}"
                    echo "Application     : ${env.APP_CONTAINER}"
                    echo "Network         : ${env.NETWORK_NAME}"

                    if (params.ENVIRONMENT == 'PRODUCTION' &&
                        params.PRODUCTION_CONFIRM != 'YES') {

                        error("Production rollback requires PRODUCTION_CONFIRM=YES")
                    }
                }

                bat """
                    echo ========================================
                    echo CHECKING ROLLBACK IMAGE
                    echo ========================================

                    docker image inspect ${IMAGE_NAME}:${params.VERSION} >nul 2>&1

                    if errorlevel 1 (
                        echo Rollback image ${IMAGE_NAME}:${params.VERSION} does not exist.
                        echo Cannot perform rollback.
                        exit /b 1
                    )

                    echo Rollback image found.

                    echo ========================================
                    echo CHECKING DATABASE CONTAINER
                    echo ========================================

                    docker inspect ${env.DB_CONTAINER} >nul 2>&1

                    if errorlevel 1 (
                        echo Database container does not exist.
                        echo Rollback cannot continue.
                        exit /b 1
                    )

                    docker start ${env.DB_CONTAINER} >nul 2>&1

                    echo Database container is available.

                    echo ========================================
                    echo STOPPING CURRENT APPLICATION
                    echo ========================================

                    docker rm -f ${env.APP_CONTAINER} >nul 2>&1

                    echo ========================================
                    echo STARTING ROLLBACK VERSION
                    echo ========================================

                    docker run -d ^
                      --name ${env.APP_CONTAINER} ^
                      --network ${env.NETWORK_NAME} ^
                      -p ${env.HOST_PORT}:3000 ^
                      -e ENVIRONMENT=${params.ENVIRONMENT} ^
                      -e APP_VERSION=${params.VERSION} ^
                      -e DB_HOST=${env.DB_CONTAINER} ^
                      -e DB_USER=customeruser ^
                      -e DB_PASSWORD=CustomerPass123! ^
                      -e DB_NAME=customerdb ^
                      ${IMAGE_NAME}:${params.VERSION}

                    echo.
                    echo ========================================
                    echo WAITING FOR ROLLBACK APPLICATION
                    echo ========================================

                    ping -n 11 127.0.0.1 >nul

                    echo.
                    echo Checking rollback container:

                    docker ps --filter "name=${env.APP_CONTAINER}"

                    echo.
                    echo Checking rollback health:

                    curl.exe -f http://127.0.0.1:${env.HOST_PORT}/health

                    if errorlevel 1 (
                        echo Rollback health check FAILED.
                        exit /b 1
                    )

                    echo.
                    echo ========================================
                    echo       ROLLBACK SUCCESSFUL
                    echo ========================================

                    echo Environment : ${params.ENVIRONMENT}
                    echo Version     : ${params.VERSION}
                    echo Application : ${env.APP_CONTAINER}
                    echo Database    : ${env.DB_CONTAINER}
                    echo Network     : ${env.NETWORK_NAME}
                    echo URL         : http://127.0.0.1:${env.HOST_PORT}

                    echo ========================================
                """
            }
        }
    }

    post {

        success {
            echo "========================================"
            echo "PIPELINE COMPLETED SUCCESSFULLY"
            echo "========================================"
        }

        failure {
            echo "========================================"
            echo "PIPELINE FAILED"
            echo "========================================"
            echo "Review the Jenkins console output."
        }

        always {
            echo "Jenkins pipeline execution completed."
        }
    }
}
