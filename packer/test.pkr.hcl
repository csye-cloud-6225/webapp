name: Packer AMI Build

on:
  push:
    branches:
      - main

jobs:
  build-ami:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v2

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Setup Packer
        uses: hashicorp/setup-packer@main
        with:
          version: "1.9.4"

      - name: Create env
        run: |
          echo "DB_HOST: ${{ secrets.DB_HOST }}" >> .env
          echo "DB_USER: ${{ secrets.DB_USER }}" >> .env
          echo "DB_PASSWORD: ${{ secrets.Password }}" >> .env
          echo "DB_NAME: ${{ secrets.DB_NAME }}" >> .env
          echo "DB_PORT: ${{ secrets.DB_PORT }}" >> .env
          echo "APP_PORT: ${{ secrets.APP_PORT }}" >> .env
          echo "PORT_MAPPING: ${{ secrets.PORT_MAPPING }}" >> .env



      - name: Create webapp.zip
        run: |
          mkdir -p packer-template
          zip -r webapp.zip . -x ".git" "packer-template/" ".github/"
          mv webapp.zip packer-template/

      - name: Move necessary files to packer-template
        run: |
          mv my-app.service packer-template/
          mv packer/install_webapp.sh packer-template/
          mv packer/test.pkr.hcl packer-template/

      - name: List repository contents
        run: |
          echo "Root directory contents:"
          ls -la
          echo "packer-template directory contents:"
          ls -la packer-template

      - name: Check necessary files
        run: |
          for file in webapp.zip my-app.service install_webapp.sh test.pkr.hcl; do
            if [ ! -f "packer-template/$file" ]; then
              echo "$file not found in packer-template directory"
              echo "Current directory structure:"
              find . -type f
              exit 1
            fi
          done

      - name: Create variables file
        run: |
          cat << EOF > packer-template/variables.pkrvars.hcl
          aws_region = "us-east-1"
          instance_type = "t2.small"
          ssh_username = "ubuntu"
          source_ami = "ami-0cad6ee50670e3d0e"
          subnet_id = "subnet-01559dcd81713aec8"
          EOF

      - name: Initialize Packer
        run: packer init ./packer-template/test.pkr.hcl

      - name: Validate Packer Template
        run: |
          cd packer-template
          packer validate -var-file=variables.pkrvars.hcl \
            -var "db_host=${{ secrets.DB_HOST }}" \
            -var "db_user=${{ secrets.DB_USER }}" \
            -var "db_password=${{ secrets.Password }}" \
            -var "db_name=${{ secrets.DB_NAME }}" \
            -var "db_port=${{ secrets.DB_PORT }}" \
            test.pkr.hcl

      - name: Build AMI
        run: |
          cd packer-template
          packer build -debug -var-file=variables.pkrvars.hcl \
            -var "db_host=$DB_HOST" \
            -var "db_user=$DB_USER" \
            -var "db_password=$DB_PASSWORD" \
            -var "db_name=$DB_NAME" \
            -var "db_port=$DB_PORT" \
            test.pkr.hcl
      

      