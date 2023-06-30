terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}

provider "aws" {
  profile = "sandbox"
}

data "aws_ecr_image" "is" {
  # name = "test"
  repository_name = "test"
  most_recent = true
}
