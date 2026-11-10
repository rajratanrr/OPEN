package com.roadsaathi;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class RoadSaathiApplication {
  public static void main(String[] args) {
    SpringApplication.run(RoadSaathiApplication.class, args);
  }
}
