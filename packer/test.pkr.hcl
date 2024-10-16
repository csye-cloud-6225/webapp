build {
  sources = ["source.amazon-ebs.my-ami"]

  provisioner "file" {
    source      = "${path.root}/webapp.zip"
    destination = "/tmp/webapp.zip"
  }

  provisioner "file" {
    source      = "${path.root}/my-app.service"
    destination = "/tmp/my-app.service"
  }

  provisioner "file" {
    source      = "${path.root}/install_webapp.sh"
    destination = "/tmp/install_webapp.sh"
  }

  provisioner "shell" {
    inline = [
      "ls -la /tmp",  // Add this line to check the contents of /tmp
      "sudo mv /tmp/my-app.service /etc/systemd/system/",
      "sudo chown root:root /etc/systemd/system/my-app.service",
      "sudo chmod 644 /etc/systemd/system/my-app.service"
    ]
  }

  provisioner "shell" {
    environment_vars = [
      "DB_PASSWORD=${var.Password}",
      "DB_NAME=${var.DB_NAME}"
    ]
    inline = [
      "chmod +x /tmp/install_webapp.sh",
      "sudo -E /tmp/install_webapp.sh"
    ]
  }
}