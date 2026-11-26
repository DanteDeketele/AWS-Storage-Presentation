terraform {
  required_version = ">= 1.5"
  required_providers {
    aws     = { source = "hashicorp/aws", version = "~> 6.0" }
    archive = { source = "hashicorp/archive", version = "~> 2.0" }
    local   = { source = "hashicorp/local", version = "~> 2.0" }
    random  = { source = "hashicorp/random", version = "~> 3.0" }
  }
}

provider "aws" {
  region = var.region
  default_tags { tags = { Project = var.project } }
}

variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "project" {
  type    = string
  default = "ebs-demo"
}

variable "max_age_min" {
  description = "Demo-resources ouder dan dit worden automatisch verwijderd"
  type        = number
  default     = 20
}

locals {
  tag = "ebs-demo-live" # tag op alles wat de demo live aanmaakt
}

data "aws_caller_identity" "me" {}

# ------------------------------------------------------------------ netwerk
# Default VPC gebruiken: geen NAT gateway of andere betalende netwerkonderdelen.
data "aws_vpc" "default" {
  default = true
}

data "aws_subnet" "demo" {
  vpc_id            = data.aws_vpc.default.id
  availability_zone = "${var.region}a"
  default_for_az    = true
}

resource "aws_security_group" "demo" {
  name        = "${var.project}-instance"
  description = "Geen inbound: de demo gebruikt SSM, geen SSH"
  vpc_id      = data.aws_vpc.default.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

# ------------------------------------------------------------------ demo-instance rol (SSM)
resource "aws_iam_role" "instance" {
  name = "${var.project}-instance"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "ec2.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "instance" {
  name = "${var.project}-instance"
  role = aws_iam_role.instance.name
}

# ------------------------------------------------------------------ Lambda rol
resource "aws_iam_role" "lambda" {
  name = "${var.project}-lambda"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy" "lambda" {
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.app.arn}:*" },
      { Effect = "Allow", Action = ["ec2:Describe*"], Resource = "*" },
      {
        # Enkel t3.micro kan gestart worden
        Effect    = "Allow", Action = "ec2:RunInstances", Resource = "arn:aws:ec2:${var.region}:${data.aws_caller_identity.me.account_id}:instance/*"
        Condition = { StringEquals = { "ec2:InstanceType" = "t3.micro" } }
      },
      { Effect = "Allow", Action = "ec2:RunInstances", NotResource = "arn:aws:ec2:${var.region}:${data.aws_caller_identity.me.account_id}:instance/*" },
      {
        # Nieuwe volumes en snapshots: max. 15 GB, enkel gp3 (aanmaken), tags verplicht
        Effect    = "Allow", Action = ["ec2:CreateVolume"], Resource = "*"
        Condition = { StringEquals = { "aws:RequestTag/Project" = local.tag, "ec2:VolumeType" = "gp3" } }
      },
      { Effect = "Allow", Action = ["ec2:CreateSnapshot"], Resource = "*" },
      { Effect = "Allow", Action = ["ec2:CreateTags"], Resource = "*", Condition = { StringEquals = { "ec2:CreateAction" = ["RunInstances", "CreateVolume", "CreateSnapshot"] } } },
      {
        # Wijzigen/verwijderen: enkel resources met de demo-tag
        Effect = "Allow"
        Action = ["ec2:TerminateInstances", "ec2:AttachVolume", "ec2:DetachVolume", "ec2:DeleteVolume",
        "ec2:ModifyVolume", "ec2:ModifyInstanceAttribute", "ec2:DeleteSnapshot"]
        Resource  = "*"
        Condition = { StringEquals = { "aws:ResourceTag/Project" = local.tag } }
      },
      { Effect = "Allow", Action = "iam:PassRole", Resource = aws_iam_role.instance.arn },
      {
        Effect = "Allow", Action = "ssm:SendCommand"
        Resource = [
          "arn:aws:ssm:${var.region}::document/AWS-RunShellScript",
          "arn:aws:ec2:${var.region}:${data.aws_caller_identity.me.account_id}:instance/*",
        ]
      },
      { Effect = "Allow", Action = ["ssm:GetCommandInvocation", "ssm:DescribeInstanceInformation"], Resource = "*" },
    ]
  })
}

# ------------------------------------------------------------------ Lambda
resource "random_password" "demo_key" {
  length  = 20
  special = false
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/aws/lambda/${var.project}"
  retention_in_days = 7
}

# Configuratie als bestand in de zip, niet als environment variables:
# sommige accounts blokkeren kms:Encrypt via een SCP, en Lambda versleutelt env vars met KMS.
resource "local_sensitive_file" "config" {
  filename = "${path.module}/../app/config.json"
  content = jsonencode({
    TAG              = local.tag
    DEMO_KEY         = random_password.demo_key.result
    AMI_ID           = data.aws_ami.al2023.id
    SUBNET_ID        = data.aws_subnet.demo.id
    SG_ID            = aws_security_group.demo.id
    INSTANCE_PROFILE = aws_iam_instance_profile.instance.name
    MAX_AGE_MIN      = tostring(var.max_age_min)
  })
}

data "archive_file" "app" {
  type        = "zip"
  source_dir  = "${path.module}/../app"
  output_path = "${path.module}/.build/app.zip"
  excludes    = ["__pycache__"]
  depends_on  = [local_sensitive_file.config]
}

resource "aws_lambda_function" "app" {
  function_name    = var.project
  role             = aws_iam_role.lambda.arn
  runtime          = "python3.13"
  handler          = "app.handler"
  filename         = data.archive_file.app.output_path
  source_code_hash = data.archive_file.app.output_base64sha256
  timeout          = 60
  memory_size      = 256

  depends_on = [aws_cloudwatch_log_group.app, aws_iam_role_policy.lambda]
}

resource "aws_lambda_function_url" "app" {
  function_name      = aws_lambda_function.app.function_name
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "url" {
  statement_id           = "public-url"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.app.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "url_invoke" {
  statement_id             = "public-url-invoke"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.app.function_name
  principal                = "*"
  invoked_via_function_url = true
}

# ------------------------------------------------------------------ automatisch opruimen
resource "aws_cloudwatch_event_rule" "reaper" {
  name                = "${var.project}-reaper"
  description         = "Verwijdert demo-resources ouder dan ${var.max_age_min} minuten"
  schedule_expression = "rate(5 minutes)"
}

resource "aws_cloudwatch_event_target" "reaper" {
  rule = aws_cloudwatch_event_rule.reaper.name
  arn  = aws_lambda_function.app.arn
}

resource "aws_lambda_permission" "reaper" {
  statement_id  = "reaper"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.app.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.reaper.arn
}

# ------------------------------------------------------------------ outputs
output "url" {
  value = aws_lambda_function_url.app.function_url
}

output "demo_key" {
  value     = random_password.demo_key.result
  sensitive = true
}

output "presenter_url" {
  description = "Open deze link om de knoppen te gebruiken (sleutel wordt onthouden)"
  value       = "${aws_lambda_function_url.app.function_url}?key=${random_password.demo_key.result}"
  sensitive   = true
}
